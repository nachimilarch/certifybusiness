import { Job } from "bullmq";
import fs from "fs";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { logger } from "../../core/logger";
import type { CsvImportJobData } from "../../modules/imports/import.service";
import type { Channel } from "../../core/types";

// ─── Column aliases ───────────────────────────────────────────────────────────

const ALIASES: Record<string, string> = {
  // first_name
  firstname: "first_name", "first name": "first_name", fname: "first_name",
  // last_name
  lastname: "last_name", "last name": "last_name", lname: "last_name", surname: "last_name",
  // phone
  phone_number: "phone", "phone number": "phone", mobile: "phone",
  mobile_number: "phone", contact: "phone", "mobile number": "phone",
  "phone no": "phone", "contact number": "phone",
  // email
  email_address: "email", "email address": "email", "e-mail": "email",
  "e mail": "email",
  // company
  company_name: "company", organization: "company", organisation: "company",
  "company name": "company", org: "company", business: "company",
  // designation
  title: "designation", job_title: "designation", "job title": "designation",
  position: "designation", role: "designation",
};

function normaliseHeader(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return ALIASES[lower] ?? lower.replace(/\s+/g, "_");
}

// ─── Validation ───────────────────────────────────────────────────────────────

const PHONE_RE = /\d{5,}/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(
  row: Record<string, string>,
  channel: Channel
): string[] {
  const errors: string[] = [];

  const hasName = row.first_name?.trim() || row.last_name?.trim();
  if (!hasName) errors.push("first_name or last_name is required");

  if ((channel === "calling" || channel === "whatsapp" || channel === "sms") && !row.phone?.trim()) {
    errors.push("phone is required for " + channel);
  }
  if (channel === "email" && !row.email?.trim()) {
    errors.push("email is required for email channel");
  }
  if (row.phone && !PHONE_RE.test(row.phone.replace(/\D/g, ""))) {
    errors.push("phone number appears invalid");
  }
  if (row.email && !EMAIL_RE.test(row.email.trim())) {
    errors.push("email address appears invalid");
  }

  return errors;
}

// ─── Suppression batch check ──────────────────────────────────────────────────

async function getSuppressedValues(
  db: ReturnType<typeof getDb>,
  orgId: string,
  phones: string[],
  emails: string[]
): Promise<{ phones: Set<string>; emails: Set<string> }> {
  const conditions: Array<{ type: string; value: string }> = [
    ...phones.map((p) => ({ type: "phone", value: p })),
    ...emails.map((e) => ({ type: "email", value: e })),
    ...phones.map((p) => ({ type: "whatsapp", value: p })),
  ];

  if (conditions.length === 0) return { phones: new Set(), emails: new Set() };

  const rows = await db("suppression_list")
    .where("organisation_id", orgId)
    .where((qb) => {
      for (const c of conditions) {
        qb.orWhere({ type: c.type, value: c.value });
      }
    })
    .select("type", "value");

  const suppPhones = new Set<string>();
  const suppEmails = new Set<string>();
  for (const r of rows) {
    if (r.type === "phone" || r.type === "whatsapp") suppPhones.add(r.value);
    if (r.type === "email") suppEmails.add(r.value);
  }
  return { phones: suppPhones, emails: suppEmails };
}

// ─── Chunk insert ─────────────────────────────────────────────────────────────

const CHUNK = 500;

async function bulkInsert(db: ReturnType<typeof getDb>, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db("uploaded_contacts").insert(rows.slice(i, i + CHUNK));
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

export async function processCsvImport(job: Job<CsvImportJobData>): Promise<void> {
  const db = getDb();
  const { listId, orgId, filePath, channel } = job.data;

  logger.info("[csv-import] starting", { listId, channel });

  // Mark as processing
  await db("uploaded_lists").where("id", listId).update({ status: "processing" });

  if (!fs.existsSync(filePath)) {
    await db("uploaded_lists").where("id", listId).update({
      status: "failed",
      error_message: `File not found: ${filePath}`,
    });
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const toInsert: object[] = [];
  let totalRows = 0;
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  let suppressedRows = 0;

  // Intra-batch duplicate tracking
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  // Collect all phones/emails for batch suppression lookup
  const allPhones: string[] = [];
  const allEmails: string[] = [];

  // Parsed rows buffer (two-pass: collect then check suppression)
  type ParsedRow = {
    id: string;
    listId: string;
    orgId: string;
    rowNum: number;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    designation: string | null;
    phone: string | null;
    email: string | null;
    extraData: Record<string, string>;
    validationErrors: string[];
    isValid: boolean;
    isDuplicate: boolean;
  };

  const parsedRows: ParsedRow[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        columns: (headers: string[]) => headers.map(normaliseHeader),
        skip_empty_lines: true,
        trim: true,
        bom: true, // strip BOM if present
        relax_column_count: true,
      });

      const stream = createReadStream(filePath).pipe(parser);

      parser.on("readable", () => {
        let record: Record<string, string> | null;
        while ((record = parser.read()) !== null) {
          totalRows++;
          const rowNum = totalRows;

          // Extract known fields
          const phone = record.phone?.trim() || null;
          const email = record.email?.trim().toLowerCase() || null;
          const first_name = record.first_name?.trim() || null;
          const last_name = record.last_name?.trim() || null;
          const company = record.company?.trim() || null;
          const designation = record.designation?.trim() || null;

          // Extra data: any key that isn't a standard column
          const STANDARD = new Set(["first_name", "last_name", "phone", "email", "company", "designation"]);
          const extraData: Record<string, string> = {};
          for (const [k, v] of Object.entries(record)) {
            if (!STANDARD.has(k) && v) extraData[k] = v;
          }

          // Validate
          const validationErrors = validateRow(record, channel);
          const isValid = validationErrors.length === 0;

          // Intra-batch dedup
          let isDuplicate = false;
          if (phone && seenPhones.has(phone)) {
            isDuplicate = true;
          } else if (email && seenEmails.has(email)) {
            isDuplicate = true;
          }

          if (!isDuplicate) {
            if (phone) { seenPhones.add(phone); allPhones.push(phone); }
            if (email) { seenEmails.add(email); allEmails.push(email); }
          }

          parsedRows.push({
            id: uuidv4(),
            listId,
            orgId,
            rowNum,
            first_name,
            last_name,
            company,
            designation,
            phone,
            email,
            extraData,
            validationErrors,
            isValid,
            isDuplicate,
          });
        }
      });

      parser.on("error", reject);
      parser.on("end", resolve);
    });
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    await db("uploaded_lists").where("id", listId).update({
      status: "failed",
      error_message: `CSV parse error: ${msg}`,
      total_rows: totalRows,
    });
    throw parseErr;
  }

  // Batch suppression check
  const { phones: suppPhones, emails: suppEmails } = await getSuppressedValues(
    db,
    orgId,
    allPhones,
    allEmails
  );

  // Build insert rows
  for (const p of parsedRows) {
    const isSuppressed =
      !p.isDuplicate &&
      ((p.phone && suppPhones.has(p.phone)) || (p.email && suppEmails.has(p.email)));

    if (p.isDuplicate) duplicateRows++;
    else if (isSuppressed) suppressedRows++;
    else if (!p.isValid) invalidRows++;
    else validRows++;

    toInsert.push({
      id: p.id,
      list_id: p.listId,
      organisation_id: p.orgId,
      row_number: p.rowNum,
      first_name: p.first_name,
      last_name: p.last_name,
      company: p.company,
      designation: p.designation,
      phone: p.phone,
      email: p.email,
      extra_data: Object.keys(p.extraData).length ? JSON.stringify(p.extraData) : null,
      is_valid: p.isValid ? 1 : 0,
      validation_errors: p.validationErrors.length ? JSON.stringify(p.validationErrors) : null,
      is_suppressed: isSuppressed ? 1 : 0,
      is_duplicate: p.isDuplicate ? 1 : 0,
      lead_id: null,
      created_at: new Date(),
    });
  }

  // Bulk insert contacts
  await bulkInsert(db, toInsert);

  // Update list with final stats
  await db("uploaded_lists").where("id", listId).update({
    status: "completed",
    total_rows: totalRows,
    valid_rows: validRows,
    invalid_rows: invalidRows,
    duplicate_rows: duplicateRows,
    suppressed_rows: suppressedRows,
    processed_at: new Date(),
  });

  logger.info("[csv-import] completed", {
    listId,
    totalRows,
    validRows,
    invalidRows,
    duplicateRows,
    suppressedRows,
  });
}
