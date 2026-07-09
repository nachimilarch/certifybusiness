/** Replace {{variable_name}} placeholders with contact data. */
export function renderTemplate(
  body: string,
  variables: Record<string, string | null | undefined>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? "");
}

/** Extract variable names referenced in a template string. */
export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}
