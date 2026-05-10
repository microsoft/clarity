/**
 * generate-test-types.ts
 *
 * Generates runtime .ts files from .d.ts declaration files so that unit tests
 * can import enum values at runtime.
 *
 * ## Why this is needed
 *
 * clarity-js declares its types in .d.ts files using `const enum`. These are
 * compile-time-only constructs — the TypeScript compiler inlines their values
 * (e.g., Event.Scroll becomes 10) and emits NO JavaScript for the enum itself.
 *
 * Modern test runners (Vitest, Jest+swc) use fast "isolated module" transforms
 * (esbuild, SWC) that process each file independently. They can't look up
 * const enum values from external .d.ts files because they never build the
 * cross-file type graph that tsc does.
 *
 * This script bridges the gap: it reads the .d.ts files, extracts the enum
 * declarations, and writes equivalent .ts files that export real runtime objects.
 * The test runner's path aliases then point at these generated files instead of
 * the original .d.ts files.
 *
 * ## What it does
 *
 * For each .d.ts file in packages/clarity-js/types/:
 *   1. Parses the file using the TypeScript compiler API (proper AST, not regex)
 *   2. Converts `const enum Foo { A = 1 }` → `const Foo = { A: 1 } as const`
 *   3. Passes through all non-enum declarations unchanged (interfaces, types, etc.)
 *   4. Rewrites `@clarity-types/X` imports to relative `./X` imports
 *   5. Writes the result to test/generated-types/
 *
 * ## Cross-file enum references
 *
 * Some enums reference values from other enums in different files. For example,
 * in data.d.ts:
 *   `SessionTimeout = 30 * Time.Minute`
 * where Time.Minute is defined in core.d.ts as 60000.
 *
 * To handle this, the script:
 *   - Processes files in dependency order (core.d.ts before data.d.ts)
 *   - Stores all resolved enum values in `resolvedEnums`
 *   - When it encounters an expression like `30 * Time.Minute`, it substitutes
 *     known values (Time.Minute → 60000) and evaluates the math (30 * 60000 → 1800000)
 *
 * ## Usage
 *
 *   npx tsx scripts/generate-test-types.ts
 *
 * Or via the package script:
 *
 *   yarn workspace clarity-js generate-test-types
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

// --- Configuration ---

// Input: the directory containing .d.ts declaration files
const TYPES_DIR = path.resolve(__dirname, "../packages/clarity-js/types");

// Output: generated .ts files that tests can import at runtime (gitignored)
const OUTPUT_DIR = path.resolve(__dirname, "../packages/clarity-js/test/generated-types");

/**
 * Files that must be processed first because other files depend on their enums.
 * For example, data.d.ts uses `Time.Minute` from core.d.ts in computed expressions.
 *
 * Files not listed here are processed after these, in filesystem order.
 */
const FILE_ORDER = ["core.d.ts", "data.d.ts"];

/**
 * Registry of all enum values resolved so far, keyed by enum name.
 * Used to resolve cross-file references like `Time.Minute` when processing
 * a later file that depends on it.
 *
 * Example state after processing core.d.ts:
 *   { "Time": { "Second": 1000, "Minute": 60000, "Hour": 3600000, ... } }
 */
const resolvedEnums: Record<string, Record<string, number | string>> = {};

// --- Entry point ---

main();

/**
 * Top-level orchestration: ensure output directory exists, then process each
 * .d.ts file — dependency-ordered files first, then the rest.
 */
function main(): void {
    ensureOutputDir();

    // Process dependency-ordered files first
    for (const file of FILE_ORDER) {
        if (fs.existsSync(path.join(TYPES_DIR, file))) {
            processFile(file);
            console.log(`  Generated: ${file.replace(".d.ts", ".ts")}`);
        }
    }

    // Process all remaining .d.ts files (order doesn't matter for these)
    const allFiles = fs.readdirSync(TYPES_DIR).filter(f => f.endsWith(".d.ts"));
    for (const file of allFiles) {
        if (!FILE_ORDER.includes(file)) {
            processFile(file);
            console.log(`  Generated: ${file.replace(".d.ts", ".ts")}`);
        }
    }

    console.log(`\nGenerated ${allFiles.length} runtime type files in ${OUTPUT_DIR}`);
}

// --- File-level processing ---

/**
 * Processes a single .d.ts file: parses it, transforms enums, and writes
 * the output .ts file.
 *
 * Non-enum declarations (interfaces, type aliases, imports) are kept as-is.
 * The only modification to non-enum code is rewriting import paths from
 * `@clarity-types/X` to relative `./X` (since the generated files live in
 * a flat directory, not behind the path alias).
 */
function processFile(filename: string): void {
    const inputPath = path.join(TYPES_DIR, filename);
    const content = fs.readFileSync(inputPath, "utf8");

    // Use the TypeScript compiler API to parse the file into an AST.
    // This is much more reliable than regex for handling edge cases like
    // string values containing braces, comments inside enums, etc.
    const sourceFile = ts.createSourceFile(
        filename,
        content,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TS
    );

    const outputParts: string[] = [];

    // Walk each top-level statement in the file
    for (const statement of sourceFile.statements) {
        if (ts.isEnumDeclaration(statement)) {
            // Transform: const enum → as const object + type alias
            outputParts.push(processEnum(statement, sourceFile));
        } else {
            // Keep as-is: interfaces, type aliases, imports, etc.
            // These are valid TypeScript that works in .ts files too.
            let text = statement.getText(sourceFile);

            // Rewrite path alias imports: the generated files are in a flat directory,
            // so `@clarity-types/core` becomes `./core` (a relative sibling import).
            text = text.replace(/from\s+["']@clarity-types\/(\w+)["']/, 'from "./$1"');

            outputParts.push(text);
        }
    }

    let output = outputParts.join("\n\n");

    // Catch any @clarity-types references that weren't in import statements
    // (e.g., in re-export declarations or dynamic imports)
    output = output.replace(
        /["']@clarity-types\/(\w+)["']/g,
        '"./$1"'
    );

    // Write as .ts (not .d.ts) so it produces real JavaScript at runtime
    const outputFilename = filename.replace(/\.d\.ts$/, ".ts");
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    fs.writeFileSync(outputPath, output, "utf8");
}

// --- Enum transformation ---

/**
 * Converts a single `const enum` declaration into an `as const` object.
 *
 * Input (AST node representing):
 *   export const enum Event { Scroll = 10, Resize = 11 }
 *
 * Output (string):
 *   export const Event = {
 *       Scroll: 10,
 *       Resize: 11,
 *   } as const;
 *   export type Event = typeof Event[keyof typeof Event];
 *
 * The type alias line recreates the union type (10 | 11) so that code using
 * `Event` as a type annotation still works. See the testing doc for a detailed
 * explanation of this pattern.
 *
 * Also stores all resolved member values in `resolvedEnums` so that later
 * files can reference them (e.g., `30 * Time.Minute`).
 */
function processEnum(node: ts.EnumDeclaration, sourceFile: ts.SourceFile): string {
    const name = node.name.text;
    const members: Record<string, number | string> = {};
    const lines: string[] = [];

    // Track the auto-increment counter for members without explicit values.
    // In TypeScript enums, if you write `A, B, C` without values, they get 0, 1, 2.
    // If you write `A = 5, B`, then B gets 6.
    let autoValue = 0;

    for (const member of node.members) {
        const memberName = member.name.getText(sourceFile);
        let value: number | string;

        if (member.initializer) {
            // This member has an explicit value (e.g., `Scroll = 10` or `Empty = ""`)
            const initText = member.initializer.getText(sourceFile);

            if (ts.isStringLiteral(member.initializer)) {
                // String literal: `Empty = ""`  →  Empty: "",
                // JSON.stringify handles escaping quotes and special characters
                value = JSON.stringify(member.initializer.text);
                lines.push(`    ${memberName}: ${value},`);
            } else if (ts.isNumericLiteral(member.initializer)) {
                // Simple number: `Scroll = 10`  →  Scroll: 10,
                value = Number(initText);
                autoValue = value + 1; // next auto-value continues from here
                lines.push(`    ${memberName}: ${value},`);
            } else {
                // Computed expression: `SessionTimeout = 30 * Time.Minute`
                // Try to resolve cross-file references and evaluate the math
                const evaluated = evaluateExpression(initText);
                if (evaluated !== undefined) {
                    value = evaluated;
                    autoValue = value + 1;
                    lines.push(`    ${memberName}: ${value},`);
                } else {
                    // Can't evaluate — keep the original expression text.
                    // This will likely cause a runtime error if the reference
                    // wasn't resolved, but it's better than silently dropping it.
                    value = initText;
                    lines.push(`    ${memberName}: ${initText},`);
                }
            }
        } else {
            // No explicit value — use auto-increment (standard TypeScript enum behavior)
            value = autoValue;
            autoValue++;
            lines.push(`    ${memberName}: ${value},`);
        }

        members[memberName] = value;
    }

    // Store resolved values so later files can reference this enum's members
    resolvedEnums[name] = members;

    // Build the output:
    //   export const Event = { ... } as const;
    //   export type Event = typeof Event[keyof typeof Event];
    return [
        `export const ${name} = {`,
        ...lines,
        `} as const;`,
        `export type ${name} = typeof ${name}[keyof typeof ${name}];`,
    ].join("\n");
}

// --- Expression evaluation ---

/**
 * Attempts to evaluate a numeric expression that may contain references to
 * previously resolved enum values.
 *
 * For example, given the expression "30 * Time.Minute":
 *   1. Looks up Time.Minute in resolvedEnums → 60000
 *   2. Substitutes to get "30 * 60000"
 *   3. Evaluates the arithmetic → 1800000
 *
 * Returns undefined if the expression can't be safely evaluated
 * (e.g., it contains unresolved references or non-numeric content).
 */
function evaluateExpression(expr: string): number | undefined {
    let resolved = expr;

    // Substitute all known EnumName.MemberName references with their numeric values.
    // Only substitutes numeric values — string enum members can't appear in arithmetic.
    for (const [enumName, members] of Object.entries(resolvedEnums)) {
        for (const [memberName, value] of Object.entries(members)) {
            if (typeof value === "number") {
                // \b ensures we match whole identifiers only (not partial matches)
                const pattern = new RegExp(`\\b${enumName}\\.${memberName}\\b`, "g");
                resolved = resolved.replace(pattern, String(value));
            }
        }
    }

    // Safety check: only evaluate if the result contains nothing but numbers and
    // arithmetic operators. This prevents executing arbitrary code.
    try {
        if (/^[\d\s+\-*/().]+$/.test(resolved)) {
            const result = new Function(`return (${resolved})`)();
            if (typeof result === "number" && !isNaN(result)) {
                return result;
            }
        }
    } catch {
        // Expression couldn't be evaluated — fall through to return undefined
    }
    return undefined;
}

// --- Utilities ---

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}
