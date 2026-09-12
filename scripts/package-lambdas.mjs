import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const lambdaDirs = [
  path.join(repoRoot, "lambda", "resolver"),
  path.join(repoRoot, "lambda", "worker"),
  path.join(repoRoot, "lambda", "ai")
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed in ${cwd}: ${command} ${args.join(" ")}`);
  }
}

for (const lambdaDir of lambdaDirs) {
  console.log(`Packaging Lambda in ${lambdaDir}`);
  const hasLockfile = existsSync(path.join(lambdaDir, "package-lock.json"));
  run(npmCommand, [hasLockfile ? "ci" : "install", "--omit=dev"], lambdaDir);
  run(npxCommand, ["tsc", "-p", "tsconfig.json"], lambdaDir);

  const builtFile = path.join(lambdaDir, "dist", "index.js");
  if (!existsSync(builtFile)) {
    throw new Error(`Expected build output was not found: ${builtFile}`);
  }
}

console.log("Lambda packaging complete.");
