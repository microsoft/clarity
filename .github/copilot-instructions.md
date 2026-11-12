# Clarity Repository - Copilot Agent Instructions

## Repository Overview

Clarity is an open-source TypeScript behavioral analytics library for tracking user interactions and session replays. Monorepo with Lerna/Yarn workspaces:

- **clarity-js** (packages/clarity-js): Core instrumentation library
- **clarity-decode** (packages/clarity-decode): Data decoder
- **clarity-visualize** (packages/clarity-visualize): Session replay visualization
- **clarity-devtools** (packages/clarity-devtools): Chrome extension (private)

**Stack:** TypeScript, Rollup, TSLint, Playwright, Lerna, Yarn workspaces

## clarity-js Performance & Bundle Size Priorities

**Critical:** clarity-js has two top priorities that must guide all development decisions:

1. **Performance** - As an analytics library running on diverse websites, clarity-js must not hurt website performance or impact metrics like INP (Interaction to Next Paint) or PLT (Page Load Time). Balance data collection needs with:
   - Avoid blocking the main thread
   - Minimize network requests
   - Reduce payload size

2. **Bundle Size** - Small bundle size is crucial for loading clarity-js quickly and starting data collection as soon as possible. Every byte matters.

## Build & Development Commands

### Installation
**ALWAYS run `yarn install` before building or testing.** (~25s, peer dependency warnings are normal)

### Building

```bash
yarn build              # All packages (~45s, Lerna parallel build)
yarn build:js           # clarity-js only (~20s)
yarn build:decode       # clarity-decode only
yarn build:visualize    # clarity-visualize only
yarn build:devtools     # clarity-devtools only
```

Rollup + TypeScript → multiple formats (CJS, ESM, IIFE minified). Build artifacts auto-cleaned to `build/` or `extension/` (gitignored).

**Build outputs per package:**
- clarity-js: `clarity.js` (CJS), `clarity.module.js` (ESM), `clarity.min.js` (minified), plus variants: `clarity.extended.js`, `clarity.insight.js`, `clarity.performance.js`, `clarity.livechat.js`, and dynamic agent builds (`clarity.tidio.js`, `clarity.crisp.js`)
- clarity-decode: `clarity.decode.js` (CJS), `clarity.decode.module.js` (ESM), `clarity.decode.min.js` (minified)
- clarity-visualize: `clarity.visualize.js` (CJS), `clarity.visualize.module.js` (ESM), `clarity.visualize.min.js` (minified)
- clarity-devtools: Output to `extension/` directory for Chrome extension

### Testing

```bash
yarn test                                      # Root: Runs Playwright tests (all projects)
yarn test:ui                                   # Root: Runs Playwright tests in UI mode
yarn workspace clarity-js test                 # clarity-js only (Playwright with clarity-js project)
yarn workspace clarity-decode test             # clarity-decode only (Playwright with clarity-decode project)
```

Tests use Playwright test runner configured in `playwright.config.ts` at the repo root. Each package has its own Playwright project configuration.

**Test structure:**
- Per-package tests: `packages/*/test/*.test.ts`
- Root e2e tests: `test/*.test.ts`
- Playwright auto-discovers test directories that have both `test/` folder and `package.json`
- Test helpers: `test/helper.ts` (root), `packages/clarity-js/test/helper.ts` (package-specific)

### Linting

```bash
cd packages/<package> && yarn tslint       # Check linting
cd packages/<package> && yarn tslint:fix   # Auto-fix
```

**Important:** Existing TSLint errors exist - only fix what you change. Key rules: max 140 chars, typedefs required, no `var`, use `as` not `<>` for assertions.

## Project Architecture

### Structure
```
packages/
  clarity-js/src/         # Main package
    core/                 # Config, events, version.ts (source of truth)
    layout/               # DOM tracking, mutations
    interaction/          # User interactions
    performance/          # Metrics
    data/, diagnostic/, insight/, dynamic/
  clarity-decode/         # Decoder (depends on clarity-js)
  clarity-visualize/      # Visualization (depends on clarity-decode)
  clarity-devtools/       # DevTools (depends on all three)
scripts/
  bump-version.ts         # Version bumping (updates version.ts + all package.json)
  check-file-size.sh      # Bundle size validation
playwright.config.ts      # Playwright test configuration
```

**Per-package configs:** `tsconfig.json` (ES5 target), `tslint.json`, `rollup.config.ts`, `package.json`

**Common file patterns:**
- `encode.ts` files: Data encoding logic, found in various modules (use relative imports, not @src alias)
- `rollup.config.ts`: Per-package build configuration defining output formats
- `helper.ts`: Test utility functions (root test/ and packages/clarity-js/test/)
- `version.ts`: Single source of truth for version (packages/clarity-js/src/core/version.ts)

**Dependency chain:** clarity-js → clarity-decode → clarity-visualize → clarity-devtools. Changes to upstream packages may require rebuilding dependents.

## Versioning & Release

```bash
yarn bump-version                 # Patch (default)
yarn bump-version --part=minor    # Minor
yarn bump-version --part=major    # Major
```

Updates `version.ts`, all `package.json`, `lerna.json`, and stages files. Then commit, push, create PR.

## Environment

**Node.js:** 22+ required
**Package manager:** Yarn only (has yarn.lock, uses workspaces) - install globally: `npm i -g yarn`

## Common Issues

1. **Build fails:** Run `yarn install` first after clone/pull
2. **Test failures:** Ensure build artifacts exist with `yarn build` before running tests
3. **Peer dependency warnings:** Expected and safe to ignore
4. **TSLint errors:** Only fix your changes, use `yarn tslint:fix` for formatting
5. **clarity-js changes not reflected:** Rebuild all with `yarn build` from root

## Making Changes

**Workflow:** `yarn install` → make changes → `yarn build` → `yarn test` → lint modified files
- If changing clarity-js APIs used by other packages, rebuild all from root
- Follow TSLint rules: typedefs required, max 140 chars, `let`/`const` only, `as` assertions
- Build configs in `rollup.config.ts` generate multiple formats (CJS, ESM, IIFE)

**clarity-js specific considerations:**
- **Always prioritize performance and bundle size** - avoid blocking main thread, minimize network requests, keep bundle small
- Check bundle size impact after changes (CI runs size checks with <2% growth threshold)

**Import style for clarity-js:**
- Use `@src/<path>` aliases for cross-module imports (e.g., `from "@src/data/cookie"`, `from "@src/data/metadata"`)
- Exception: `encode.ts` files use relative imports (e.g., `from "./encode"`)

**Trust these instructions** - validated by testing. Only search if you need specifics not covered here or encounter undocumented errors.
