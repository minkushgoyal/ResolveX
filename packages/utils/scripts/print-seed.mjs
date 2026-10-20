import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const demoPath = resolve(here, "../src/demo-data.ts");
const source = readFileSync(demoPath, "utf8");

console.log("ResolveX demo data lives in packages/utils/src/demo-data.ts.");
console.log("Use it as the canonical seed payload for Firebase scripts or emulator imports.");
console.log(`\nPreview source size: ${source.length.toLocaleString()} characters`);
