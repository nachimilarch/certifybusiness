import bcrypt from "bcrypt";

async function main() {
    const password = process.argv[2];
    if (!password) {
        console.error("Usage: ts-node scripts/hash-password.ts <password>");
        process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);
    console.log(hash);
}

main();