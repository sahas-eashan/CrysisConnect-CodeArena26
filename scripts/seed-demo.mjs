import { readFile } from "node:fs/promises";
import process from "node:process";

async function main() {
  const sql = await readFile(new URL("../db/seed.sql", import.meta.url), "utf8");
  process.stdout.write(
    [
      "Demo seed prepared.",
      "Run this SQL against the RDS database after terraform apply:",
      "",
      sql
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
