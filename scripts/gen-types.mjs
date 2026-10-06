// Regenerate src/types/database.ts from the local Supabase DB.
// Writes only on success, so a stopped database can't wipe the file.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let out;
try {
  out = execFileSync(npx, ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
  });
} catch {
  console.error("Type generation failed (is the local database running? `npm run db:start`). Types left unchanged.");
  process.exit(1);
}
if (!out.includes("export type Database")) {
  console.error("Unexpected output from supabase gen types. Types left unchanged.");
  process.exit(1);
}
writeFileSync("src/types/database.ts", out);
execFileSync(npx, ["prettier", "--write", "src/types/database.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
