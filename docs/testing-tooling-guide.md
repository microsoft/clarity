# Testing clarity-js: Tooling Challenges and Options

## Decision: Jest + ts-jest for Unit Tests

**Chosen approach:** Jest with `ts-jest` in full-compiler mode for unit testing clarity-js source modules directly.

**Why:** clarity-js types use `const enum` in `.d.ts` files, which have no runtime representation. Most modern test tools (Vitest, esbuild, SWC) use fast "isolated module" transforms that can't resolve these values. `ts-jest` uses the full TypeScript compiler (`tsc`), which can — no code generation or workarounds needed.

**Rationale:**
- **Simplicity over speed.** The Vitest approach requires a custom generator script (~240 lines) that parses `.d.ts` files, resolves cross-file enum references, and writes runtime `.ts` equivalents. That's real code to maintain — when someone adds a new enum pattern or changes the type file structure, the generator could break silently. Jest/tsc just works because it uses the same compiler as the production build.
- **The speed cost is acceptable.** The tsc compilation adds a fixed ~12s overhead on a cold run (~2-4s cached). This is amortized across all tests — it doesn't grow with test count. A mature test suite with hundreds of tests will spend most of its time in test execution, not compilation. Test execution speed is not a top priority for this project.
- **One fewer build step.** No "did you forget to regenerate types?" failures. No gitignored generated directory to manage. `npx jest` just works.

**What we evaluated:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Jest + ts-jest (tsc)** | No workarounds needed, handles `const enum` natively, stable ecosystem | Slower compilation (~12s cold, ~4s cached) | **Chosen** |
| **Vitest + generated types** | Fastest execution (~0.5s), great watch mode | Requires maintaining a generator script to convert `.d.ts` → runtime `.ts` | Rejected — generator is extra maintenance |
| **Playwright only** | Already in place for integration tests | Can't unit test source modules (IIFE closure hides internals) | Keep for integration/E2E only |
| **Convert `const enum` to `as const`** | Eliminates the problem entirely | Changes production code, large migration, minor bundle size risk | Not pursued — too invasive |

**Test structure going forward:**
- **Unit tests:** `packages/clarity-js/test/*.jest.ts` — run with `npx jest` in clarity-js, direct source imports, mocked browser dependencies
- **Integration tests:** `test/*.test.ts` and `packages/*/test/*.test.ts` — run with Playwright, load built bundle in real browser, end-to-end verification

---

The rest of this document provides background on why this decision was necessary and details on each option evaluated.

---

## The Core Problem

clarity-js uses TypeScript `const enum` declarations in `.d.ts` files (e.g., `packages/clarity-js/types/data.d.ts`):

```typescript
// types/data.d.ts
export const enum Event {
    Scroll = 10,
    Document = 8,
    Resize = 11,
    // ...
}
```

**Why this matters:** A `const enum` is a compile-time-only construct. The TypeScript compiler inlines every reference as a literal number and emits **no JavaScript at runtime**. There is no `Event` object you can import — the `.d.ts` file produces zero bytes of JS output.

This is intentional: it keeps clarity-js's bundle small (a top priority). But it creates a fundamental tension with testing.

### How production works fine

Rollup builds clarity-js as an IIFE (Immediately Invoked Function Expression) bundle. During this build, the TypeScript compiler resolves every `Event.Scroll` reference to the literal `10`. The resulting `clarity.min.js` has no enum objects — just numbers. This is correct and efficient.

### Why testing is hard

Any test that wants to `import * as baseline from "@src/data/baseline"` must also resolve `baseline.ts`'s transitive dependency on `@clarity-types/data`. But `types/data.d.ts`:

1. Is a declaration file (`.d.ts`) — not a module that can be imported at runtime
2. Contains `const enum` — no runtime representation exists
3. Has no corresponding `.js` or `.ts` implementation file

Every JavaScript test runner hits this same wall. The specific error varies, but the cause is identical.

---

## What the Current Tests Do

The existing test suite uses **Playwright** as both test runner and browser host:

```
playwright.config.ts          # Discovers test projects from packages/*/test/
test/*.test.ts                # Root-level integration tests
packages/*/test/*.test.ts     # Per-package integration tests
```

### How Playwright integration tests work

1. Playwright launches a real Chromium browser
2. The test loads an HTML page and injects `clarity.min.js` (the pre-built IIFE bundle) via `eval()` or `<script>`
3. Clarity starts inside the browser, collecting real DOM events
4. The test drives interactions (clicks, scrolls) via Playwright's browser automation API
5. Clarity's `upload` callback captures encoded payloads
6. The test pulls payloads back to Node.js and decodes them with `clarity-decode`
7. Assertions run against the decoded data

```typescript
// Simplified pattern from existing tests
await page.evaluate(() => {
    clarity("start", {
        upload: (payload) => { window.payloads.push(payload); }
    });
});
await page.evaluate(() => window.scrollTo(0, 500));
const payloads = await page.evaluate("payloads");
const decoded = payloads.map(x => decode(x));
expect(decoded[0].baseline[0].data.scrollY).toBe(500);
```

### Why this works

The test never imports clarity-js source directly. It uses the compiled IIFE bundle where all `const enum` values are already inlined. The decode library provides typed access to the output.

### Why this is limiting

- **Slow**: Every test launches a browser, loads a page, waits for async events, flushes payloads
- **Indirect**: You can't test a single function — you test the entire pipeline end-to-end
- **Coarse**: Internal module state (like `baseline`'s buffer) is hidden inside the IIFE closure. You can only observe what gets encoded and uploaded
- **Fragile**: Tests depend on timing (`waitForTimeout`), DOM behavior, and the full encode/decode round-trip

---

## The IIFE Closure Problem

Even if you solve the `const enum` issue, there's a second barrier: the Rollup build wraps everything in an IIFE.

```javascript
// clarity.min.js (simplified)
(function() {
    var baseline = { /* ... */ };
    function track(event, x, y, time) { /* ... */ }
    // Nothing is exported to the outside world
})();
```

The only public API is `window.clarity()`. Internal modules like `baseline` are completely inaccessible from outside the closure.

**This only affects browser-based testing of the built bundle.** If you can import source `.ts` files directly (solving the `const enum` problem), you bypass the IIFE entirely and get direct access to module exports.

---

## Test Runner Options

### Playwright (current)

**What it is:** A browser automation framework with a built-in test runner. Tests execute in Node.js but control a real browser.

**Transform pipeline:** Playwright uses its own Babel-based TypeScript transform. You cannot swap it for another compiler (esbuild, tsx, etc.).

**Can it unit test clarity-js source?** No. Playwright's transform handles `.ts` files, but when it hits `import { Event } from "@clarity-types/data"`, it resolves to a `.d.ts` file with no runtime content. The `const enum` values don't exist.

**Best for:** Integration/E2E tests where you load the compiled bundle in a real browser.

---

### Vitest

**What it is:** A modern test runner built on Vite. Uses esbuild for TypeScript transformation (very fast). Native ESM support, Jest-compatible API.

**Transform pipeline:** Vite/esbuild strips TypeScript types and compiles to JS. Supports path aliases via config. Does NOT perform full type-checking.

**Can it unit test clarity-js source?** Almost. Vitest correctly resolves path aliases (`@src/*`) and transforms `.ts` files. But it still can't import `.d.ts` files — esbuild treats them as type-only and produces no runtime output. The `const enum` values are still missing.

**What it solves:**
- No browser needed — tests run in Node.js (or optionally in a lightweight jsdom/happy-dom environment)
- Direct module imports — no IIFE closure, you get real exports
- Fast — esbuild is orders of magnitude faster than tsc
- Good DX — watch mode, filtering, parallel execution

**What it doesn't solve:** The `.d.ts` / `const enum` runtime resolution. You need a companion solution (see "Viable Solutions" below).

---

### Jest

**What it is:** The most widely-used JS test framework. Uses custom transforms (typically `ts-jest` or `@swc/jest`) to handle TypeScript.

**Transform pipeline:** `ts-jest` uses the full TypeScript compiler; `@swc/jest` uses SWC (Rust-based, fast). Both support `const enum` inlining when configured to use the full tsc pipeline.

**Can it unit test clarity-js source?** Potentially, with `ts-jest` in "compiler" mode (not "isolated modules" mode). The full tsc compiler can inline `const enum` values from `.d.ts` files. However:
- `ts-jest` in compiler mode is **slow** (runs full type-checking)
- `@swc/jest` in isolated mode **cannot** resolve `const enum` from `.d.ts` (same problem as esbuild)
- Path alias resolution requires additional config (`moduleNameMapper`)
- Jest's ESM support is still experimental and awkward

**Verdict:** Possible but slower and more complex than Vitest. The full-tsc path is the only one that works, and it sacrifices the speed advantage of modern tools.

---

### ts-node

**What it is:** A TypeScript execution engine for Node.js. Compiles `.ts` files on-the-fly using tsc.

**Can it unit test clarity-js source?** In theory, yes — since it uses the real TypeScript compiler, it can inline `const enum` from `.d.ts` files. In practice:
- Requires a test framework on top (Mocha, tape, etc.)
- Slower than esbuild-based tools
- Path alias resolution needs `tsconfig-paths`
- ESM/CJS interop is tricky

**Verdict:** Works but dated. No real advantage over Vitest + a shim.

---

### tsx

**What it is:** A modern ts-node alternative that uses esbuild under the hood. Fast, zero-config.

**Can it unit test clarity-js source?** No — same limitation as Vitest/esbuild. `const enum` in `.d.ts` files produces no runtime output. tsx is just a faster ts-node with the same esbuild limitation.

---

### Mocha

**What it is:** The original Node.js test framework (2011). Provides the `describe`/`it` structure but no assertions or mocking — you bring your own (typically Chai for assertions, Sinon for mocks).

**Transform pipeline:** Mocha has no built-in TypeScript support. You configure it to use a "require" hook — typically `ts-node`, `tsx`, or `@swc/register`. The TypeScript capabilities depend entirely on which hook you choose.

**Can it unit test clarity-js source?** Same constraints as whatever transform you plug in. With `ts-node` (full tsc): yes. With `tsx` or `@swc/register`: no (isolated modules).

**Verdict:** Mocha itself is mature and stable, but it requires assembling multiple libraries (assertions, mocks, transforms, coverage) that Jest and Vitest include out of the box. There's no compelling reason to choose it for a new project in 2026 — it's mostly relevant for existing codebases that already use it.

---

### Node.js Built-in Test Runner (`node:test`)

**What it is:** A test runner built into Node.js itself (stable since Node 20). Zero dependencies — `import { describe, it } from "node:test"` and use `node --test` to run. Includes basic assertions via `node:assert`.

**Transform pipeline:** None. Node.js doesn't understand TypeScript natively. You must use a loader flag: `node --import tsx --test` or `node --loader ts-node/esm --test`. The `const enum` constraint depends on the loader.

**Can it unit test clarity-js source?** Same as whichever loader you use — `tsx` loader means no `const enum` support; `ts-node` loader means yes but slow.

**Verdict:** Appealing for its zero-dependency philosophy, but the DX is spartan compared to Vitest or Jest — no watch mode (as of Node 22), limited reporter options, no built-in mocking of modules (only function-level mocks). Best suited for simple libraries or projects that want to minimize dependencies. For a project like clarity-js that needs module mocking and path alias resolution, the setup cost negates the "no dependencies" benefit.

---

### Bun Test Runner

**What it is:** A test runner built into the [Bun](https://bun.sh) JavaScript runtime. Bun is an alternative to Node.js with a built-in TypeScript transpiler, bundler, and package manager. Tests run with `bun test`.

**Transform pipeline:** Bun has its own TypeScript transpiler (written in Zig, extremely fast). It operates in isolated-module mode — similar to esbuild, it strips types per-file without cross-file resolution.

**Can it unit test clarity-js source?** No — same isolated-module limitation. `const enum` in `.d.ts` files produces no runtime values. The generated-types workaround would work, but Bun's test runner uses its own API (`import { expect, test } from "bun:test"`) that's similar but not identical to Jest/Vitest.

**Verdict:** Extremely fast (fastest test runner available), but requires the Bun runtime instead of Node.js. This is a significant infrastructure change — CI/CD pipelines, developer machines, and deployment all need Bun installed. The test API is close to Jest but has gaps (less mature mocking, fewer community plugins). Worth watching, but not practical for an existing Node.js/Yarn project without a broader runtime migration.

---

## Summary Table

| Runner | Speed | Needs Browser | Handles `const enum` in `.d.ts` | Direct Source Import |
|--------|-------|--------------|----------------------------------|---------------------|
| Playwright | Slow | Yes | N/A (uses built bundle) | No (IIFE) |
| Vitest | Fast | No | No (esbuild) | Yes (with shim) |
| Jest + ts-jest (compiler) | Medium | No | Yes (full tsc) | Yes |
| Jest + @swc/jest | Fast | No | No | Yes (with shim) |
| Mocha + ts-node | Medium | No | Yes (full tsc) | Yes |
| Mocha + tsx | Fast | No | No | Yes (with shim) |
| Node.js `node:test` | Fast | No | Depends on loader | Yes (with shim) |
| Bun | Fastest | No | No (isolated) | Yes (with shim) |
| ts-node | Medium | No | Yes (full tsc) | Yes |
| tsx | Fast | No | No (esbuild) | Yes (with shim) |

---

## Jest vs Vitest: Test Code Comparison

Jest and Vitest have nearly identical test APIs. Vitest was designed as a drop-in replacement for Jest, so the test code itself looks almost the same. The differences are in configuration, imports, and how modules are mocked.

### Side-by-side example

**Vitest:**

```typescript
import { describe, test, expect, vi, beforeEach } from "vitest";
import { Event } from "@clarity-types/data";

// Mock a module — factory function, hoisted automatically
vi.mock("@src/data/encode", () => ({ default: vi.fn() }));
vi.mock("@src/core/time", () => ({ time: vi.fn(() => 0) }));

const baseline = await import("@src/data/baseline");

describe("Baseline", () => {
    beforeEach(() => {
        baseline.start();
    });

    test("scroll event updates scrollY", () => {
        baseline.track(Event.Scroll, 0, 500, 1000);
        baseline.reset();
        expect(baseline.state.data.scrollY).toBe(500);
    });
});
```

**Jest (equivalent):**

```typescript
// Jest globals are available without importing (or use @jest/globals)
import { Event } from "@clarity-types/data";

// Mock a module — same concept, different function name
jest.mock("@src/data/encode", () => ({ default: jest.fn() }));
jest.mock("@src/core/time", () => ({ time: jest.fn(() => 0) }));

// Jest doesn't support top-level await — use require or beforeAll
const baseline = require("@src/data/baseline");

describe("Baseline", () => {
    beforeEach(() => {
        baseline.start();
    });

    test("scroll event updates scrollY", () => {
        baseline.track(Event.Scroll, 0, 500, 1000);
        baseline.reset();
        expect(baseline.state.data.scrollY).toBe(500);
    });
});
```

### Key differences

| Feature | Vitest | Jest |
|---------|--------|------|
| Imports | `import { test, expect, vi } from "vitest"` | Globals (no import) or `from "@jest/globals"` |
| Mock function | `vi.fn()`, `vi.mock()` | `jest.fn()`, `jest.mock()` |
| Top-level `await` | Supported natively | Not supported (need workarounds) |
| ESM support | Native (Vite is ESM-first) | Experimental, requires `--experimental-vm-modules` |
| Config file | `vitest.config.ts` (extends Vite) | `jest.config.ts` (separate ecosystem) |
| Path aliases | Reuses Vite's `resolve.alias` | Separate `moduleNameMapper` in Jest config |
| Speed | Fast (esbuild transform) | Slower (`ts-jest` uses tsc; `@swc/jest` is faster) |
| Watch mode | Built-in, uses Vite's HMR graph | Built-in, file-system based |
| Assertions | Same API (`expect(...).toBe(...)`) | Same API |

The actual test logic (describe/test/expect) is identical. Migration between the two is mostly a find-and-replace of `jest.fn()` → `vi.fn()` and config changes.

---

## Benchmarks: Vitest vs Jest on the Baseline Tests

We ran the same baseline unit tests (15-17 tests, 1 test file) on both runners to measure real-world performance. These numbers were captured on the clarity-js codebase.

| | Vitest + generation | Jest + ts-jest (cold) | Jest + ts-jest (cached) |
|---|---|---|---|
| Total wall time | **~3.5s** | **~14.5s** | **~4s** |
| Type generation step | ~1s | N/A | N/A |
| Compilation | ~0.1s (esbuild, per file) | ~12s (tsc, full project) | ~2s (ts-jest disk cache) |
| Test execution | ~0.1s | ~0.1s | ~0.1s |
| Needs generated types | Yes | No | No |

### Interpreting these numbers

The compilation cost is **fixed per run** — it doesn't scale with the number of tests. Whether you run 1 test or 1000 tests, tsc compiles the same set of source files upfront. This means:

- **With 1 test file (current state):** The tsc overhead dominates. A 12-second compile for 15 tests that execute in 100ms feels painful.
- **With 50 test files:** The same 12-second compile is amortized across hundreds of tests. If the tests themselves take 5 seconds to run, the overhead drops from 99% of wall time to ~70%.
- **With 200+ test files:** The compile time becomes a smaller fraction, and the gap between runners narrows significantly.

In other words, the Jest/tsc approach looks worse right now than it would in a mature test suite. As the number of unit tests grows, the fixed compilation cost matters less.

### Watch mode changes the calculus

In development, you typically run tests in watch mode — re-running affected tests on every file save:

- **Vitest watch:** Re-transforms only the changed file (esbuild, ~50ms), re-runs affected tests. Feels instant.
- **Jest watch with ts-jest cache:** Re-compiles only changed files (~1-2s), re-runs affected tests. Noticeable but acceptable.

The generation step for Vitest only needs to re-run when `.d.ts` files change, which is infrequent. In watch mode, it's effectively zero cost for normal development.

### Bottom line

For a small test suite (where we are now), Vitest is noticeably faster. As the suite grows, the gap narrows because the tsc compilation is amortized. But Vitest retains an edge in watch mode regardless of suite size, since esbuild's per-file transform is fundamentally faster than tsc's project-wide compilation.

---

## Can Browser Tests Run in Vitest Instead of Playwright?

Short answer: **partially, but they serve different purposes.**

### What Vitest can do in a browser

Vitest has a [browser mode](https://vitest.dev/guide/browser/) that runs tests inside a real browser (via Playwright or WebDriver under the hood). This is useful for testing code that depends on real DOM APIs — `document.createElement`, `window.scrollTo`, `MutationObserver`, etc.

```typescript
// vitest.config.ts with browser mode
export default defineConfig({
    test: {
        browser: {
            enabled: true,
            name: "chromium",
            provider: "playwright",  // uses Playwright internally
        },
    },
});
```

In this mode, your test code runs *inside the browser*. You get real DOM APIs, and you can import source modules directly (no IIFE barrier). This could theoretically let you test clarity-js internals that need a real DOM.

### What Vitest browser mode cannot do

Playwright tests don't just run *in* a browser — they run *outside* the browser and **control** it. This is a fundamental architectural difference:

| Capability | Playwright | Vitest Browser Mode |
|-----------|-----------|-------------------|
| Navigate to URLs | Yes | No (test runs inside page) |
| Load external scripts (`clarity.min.js`) | Yes (inject via `page.evaluate`) | Not the same way |
| Simulate real user gestures (click, scroll, type) | Yes (OS-level events) | Limited (synthetic JS events) |
| Multiple pages/tabs | Yes | No |
| Network interception | Yes | No |
| Screenshot/video recording | Yes | No |
| Cross-origin iframes | Yes | No |
| Test the built IIFE bundle end-to-end | Yes (natural) | Awkward |

### What this means for clarity-js

clarity-js has two distinct testing needs:

1. **Unit tests** (test individual modules like `baseline.ts`): Jest with ts-jest is ideal. Mock browser globals, import source directly, test logic fast. This is what we set up with `yarn test:unit`.

2. **Integration/E2E tests** (test the full pipeline — instrument a page, collect events, decode payloads): Playwright is the right tool. You need to load `clarity.min.js` in a real browser, drive real user interactions, and capture the upload payloads. These tests verify that the built bundle works correctly end-to-end.

**Recommendation:** Keep Playwright for integration tests, use Jest (with ts-jest) for unit tests. They complement each other.

---

## Viable Solutions

All modern fast tools (Vitest, tsx, swc) use "isolated module" transforms that can't resolve `const enum` from external `.d.ts` files. To use these tools, you need one of these companion solutions:

### Option A: Auto-generate runtime type files

Write a script that reads each `.d.ts` file and generates a corresponding `.ts` file with runtime values:

```typescript
// Input: types/data.d.ts
export const enum Event {
    Scroll = 10,
    Resize = 11,
}

// Generated output: test/generated-types/data.ts
export const Event = {
    Scroll: 10,
    Resize: 11,
} as const;
export type Event = typeof Event[keyof typeof Event];
```

Configure the test runner's path aliases so `@clarity-types/*` resolves to the generated files instead of the `.d.ts` originals.

**Pros:**
- Production code is unchanged — zero bundle size impact
- Generated files are gitignored, derived from source of truth
- Works with any modern test runner (Vitest, Jest+swc, tsx)

**Cons:**
- Maintenance burden: the generator script must handle edge cases (computed expressions like `30 * Time.Minute`, cross-file references, interfaces, type aliases)
- Extra build step before testing
- Risk of generator output drifting from declarations if not kept in sync (mitigated by CI)

**Complexity:** The `Setting` enum in `data.d.ts` uses expressions like `30 * Time.Minute` where `Time` is defined in `core.d.ts`. The generator must process files in dependency order and evaluate these expressions.

---

### Option B: Convert `const enum` to `as const` objects

Replace the declaration-file enums with runtime objects in `.ts` files:

```typescript
// Before (data.d.ts)
export const enum Event {
    Scroll = 10,
    Resize = 11,
}

// After (data.ts)
export const Event = {
    Scroll: 10,
    Resize: 11,
} as const;
export type Event = typeof Event[keyof typeof Event];
```

**Pros:**
- Eliminates the problem entirely — no shims, no generation, no special config
- Recommended by the TypeScript team (they regret adding `const enum`)
- Works with every tool out of the box
- Nominal bundle size impact: Rollup/Terser can often constant-fold `as const` values, and the remaining overhead is a few hundred bytes for the object literals

**Cons:**
- Changes production code and types across the codebase
- Small bundle size increase (object literals instead of inlined numbers)
- Large migration surface: every file importing these enums needs updating
- The `const enum` → `as const` migration is mechanical but touches many files

---

### Option C: Generate a test-only bundle

Configure Rollup to produce a second build that exports internal modules (not an IIFE):

```javascript
// rollup.config.test.ts
export default {
    input: "src/data/baseline.ts",
    output: { format: "esm", file: "build/baseline.test.js" },
    // ... same plugins as production
};
```

**Pros:**
- Uses the same Rollup pipeline as production — `const enum` inlining happens automatically
- Tests run against code that's compiled identically to production

**Cons:**
- Slow: must rebuild before every test run
- One bundle per module you want to test, or a complex multi-entry config
- Still testing compiled output, not source — harder to debug
- Adds build complexity

---

### Recommended Path

**Jest + ts-jest** gives the best balance:

- Uses the full TypeScript compiler, so `const enum` in `.d.ts` files works without workarounds
- Direct source imports (no IIFE, no decode round-trip)
- No production code changes (no bundle size impact)
- No generated types or custom scripts to maintain

---

## Appendix: `const enum` vs `enum` vs `as const`

TypeScript offers three ways to define a fixed set of named constants. They differ significantly in what JavaScript they produce and how they interact with tooling.

### `const enum` (what clarity-js uses)

```typescript
export const enum Event {
    Scroll = 10,
    Resize = 11,
}

// Usage
const x = Event.Scroll;
```

**Compiled output:** The enum declaration produces **no JavaScript at all**. Every reference is replaced with the literal value inline:

```javascript
const x = 10; // Event.Scroll replaced by 10
```

**Pros:**
- Zero runtime overhead — no object, no lookup, just literal values
- Smallest possible bundle size
- Dead code elimination is trivial (unused values leave no trace)

**Cons:**
- Only works when the TypeScript compiler can see the declaration at compile time
- Cannot be used across module boundaries in "isolated modules" mode (explained below)
- Cannot be iterated (`Object.keys(Event)` is impossible — there's no `Event` at runtime)
- The TypeScript team has stated they [regret adding `const enum`](https://www.typescriptlang.org/docs/handbook/enums.html#const-enum-pitfalls) and recommend against it in libraries

**The `.d.ts` problem:** When a `const enum` is declared in a `.d.ts` file (as in clarity-js), only the full TypeScript compiler (`tsc`) can resolve the values. Faster tools like esbuild, SWC, and Babel don't run the type-checker — they strip types and transpile each file in isolation. They have no mechanism to look up `Event.Scroll = 10` from an external declaration file.

### `enum` (regular, non-const)

```typescript
export enum Event {
    Scroll = 10,
    Resize = 11,
}

// Usage
const x = Event.Scroll;
```

**Compiled output:** Produces a real JavaScript object:

```javascript
export var Event;
(function (Event) {
    Event[Event["Scroll"] = 10] = "Scroll";
    Event[Event["Resize"] = 11] = "Resize";
})(Event || (Event = {}));

const x = Event.Scroll; // property lookup at runtime
```

**Pros:**
- Works with all tools — the enum exists at runtime
- Can be iterated, passed as values, used in `switch` exhaustiveness checks
- Works across module boundaries

**Cons:**
- Larger bundle: each enum generates an IIFE with bidirectional mapping
- Runtime property lookups instead of inlined constants
- The bidirectional mapping (`Event[10] === "Scroll"`) is rarely useful and adds weight
- Not tree-shakeable in many bundlers

**Bundle size impact:** Each enum produces ~50-100 bytes of JavaScript depending on member count. For clarity-js with ~15 enums, this adds roughly 1-2KB to the bundle.

### `as const` objects (recommended alternative)

```typescript
export const Event = {
    Scroll: 10,
    Resize: 11,
} as const;
export type Event = typeof Event[keyof typeof Event]; // 10 | 11
```

#### Breaking down the `as const` pattern

This pattern looks cryptic but is a standard TypeScript idiom. Here's what each piece does:

**`as const`** tells TypeScript to infer the narrowest possible type. Without it, `Event.Scroll` would be typed as `number`. With `as const`, it's typed as the literal `10`:

```typescript
// Without 'as const':
const Event = { Scroll: 10 };     // type: { Scroll: number }

// With 'as const':
const Event = { Scroll: 10 } as const;  // type: { readonly Scroll: 10 }
```

**`export type Event = typeof Event[keyof typeof Event]`** creates a union type of all the values. Let's unpack it step by step:

```typescript
typeof Event
// → { readonly Scroll: 10; readonly Resize: 11 }

keyof typeof Event
// → "Scroll" | "Resize"

typeof Event[keyof typeof Event]
// → { readonly Scroll: 10; readonly Resize: 11 }["Scroll" | "Resize"]
// → 10 | 11
```

So `type Event = 10 | 11`. This means you can use `Event` as both a value namespace (`Event.Scroll`) and a type (`function foo(e: Event)`), mimicking the dual value/type behavior of TypeScript's built-in `enum`.

**Why the same name for both?** TypeScript allows a `const` and a `type` to share a name because they exist in different "declaration spaces" — the value space and the type space. The compiler knows which one you mean from context:

```typescript
const x: Event = Event.Scroll;
//       ^^^^^ type (10 | 11)
//               ^^^^^ value (the object)
```

**Compiled output:**

```javascript
export const Event = {
    Scroll: 10,
    Resize: 11,
};

const x = Event.Scroll; // property lookup, but bundlers can inline it
```

**Pros:**
- Works with all tools — it's a plain object, no special handling needed
- TypeScript infers literal types (`10 | 11` instead of `number`)
- Tree-shakeable: if unused, the object is removed entirely
- Bundlers like Rollup/Terser can often constant-fold `Event.Scroll` → `10` during minification
- No bidirectional mapping overhead (unlike `enum`)
- Recommended by the TypeScript team as the replacement for `const enum`

**Cons:**
- Slightly more verbose declaration syntax
- Object exists at runtime (unlike `const enum`) — but bundler optimization usually eliminates it
- Migration from `const enum` requires updating type annotations (the type is now `typeof Event[keyof typeof Event]` instead of `Event`)

**Bundle size impact:** Similar to regular `enum` before minification, but Rollup/Terser's constant folding often reduces it to nearly the same size as `const enum`. The practical difference is typically under 500 bytes for all of clarity-js's enums.

### Summary

| Feature | `const enum` | `enum` | `as const` |
|---------|-------------|--------|-----------|
| Runtime object | No | Yes (with reverse map) | Yes (plain) |
| Bundle size | Smallest | Largest | Small (after minification) |
| Works in isolated modules | No | Yes | Yes |
| Works with esbuild/SWC | No (in `.d.ts`) | Yes | Yes |
| Tree-shakeable | N/A (no output) | Poor | Good |
| Iterable at runtime | No | Yes | Yes |
| TypeScript team recommendation | Avoid | Use sparingly | Preferred |

---

## Appendix: What Are "Isolated Module" Transforms?

Traditional TypeScript compilation (`tsc`) processes **all files together** — it builds a full type graph, resolves cross-file references, and can inline values from other modules. This is "program mode."

Modern bundlers and test runners prioritize speed over full type analysis. Tools like **esbuild**, **SWC**, and **Babel** transform each file **independently** — they strip types and transpile to JavaScript without seeing any other file. This is "isolated module" mode (named after TypeScript's [`isolatedModules`](https://www.typescriptlang.org/tsconfig#isolatedModules) compiler option).

### How it works

In isolated mode, when esbuild processes `baseline.ts`:

```typescript
import { Event } from "@clarity-types/data";
const x = Event.Scroll;
```

It resolves the import to `types/data.d.ts`, sees it's a declaration file, strips the import (it's type-only), and tries to emit `const x = Event.Scroll`. But `Event` doesn't exist — it was a `const enum` with no runtime value. The transform fails.

In contrast, `tsc` in program mode would have already resolved `Event.Scroll` to `10` before emitting, producing `const x = 10`.

### Why tools use isolated transforms

- **Speed**: Processing files independently is trivially parallelizable. esbuild transforms thousands of files per second; `tsc` takes seconds to minutes for the same codebase.
- **Simplicity**: No need to build a type graph, resolve module paths, or understand TypeScript's full type system.
- **Streaming**: Files can be transformed as they're discovered, without waiting for the full project to be parsed.

### The trade-off

Isolated transforms can't handle any TypeScript feature that requires cross-file knowledge:
- `const enum` from other files (the values aren't available)
- `namespace` merging across files
- Certain re-export patterns

TypeScript's `isolatedModules` flag was created specifically to catch these patterns — when enabled, `tsc` reports errors for code that can't be safely transformed in isolation. This flag is now the default in many frameworks (Vite, Next.js, etc.).

### What this means for clarity-js

Every modern test runner and bundler uses isolated transforms by default. clarity-js's `const enum` in `.d.ts` files is incompatible with all of them. The only options are:
1. Use the full `tsc` compiler (slow, available via `ts-jest` or `ts-node`)
2. Generate runtime files from the declarations (the approach we chose)
3. Change the source to use `as const` instead of `const enum` (eliminates the problem entirely)
