import { copyFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Copies the repository root LICENSE file into the current package directory.
// Run as part of each package's `build` script (via ts-node) so the published npm
// tarball includes the full license text (required by many OSS compliance/license-scanning
// tools) at the package root. The copied LICENSE is git-ignored to avoid committing
// duplicates that could drift from the single source of truth at the repo root.
//
// Source is anchored to this script's location (scripts/ lives one level below the repo
// root), so it is independent of the working directory. Destination is the package that
// is currently being built, i.e. the process working directory.
const scriptDir: string = path.dirname(fileURLToPath(import.meta.url));
const repoRoot: string = path.resolve(scriptDir, "..");
const source: string = path.resolve(repoRoot, "LICENSE");
const destination: string = path.resolve(process.cwd(), "LICENSE");

try {
    copyFileSync(source, destination);
    console.log(`Copied LICENSE to ${path.relative(repoRoot, destination)}`);
} catch (error) {
    console.error(`Failed to copy LICENSE from ${source}: ${(error as Error).message}`);
    process.exit(1);
}
