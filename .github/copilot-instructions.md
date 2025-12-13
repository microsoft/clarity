# Clarity Repository - Copilot Agent Instructions

## Repository Overview

Clarity is an open-source TypeScript behavioral analytics library for tracking user interactions and session replays. Monorepo with Lerna/Yarn workspaces:

- **clarity-js** (packages/clarity-js): Core instrumentation library
- **clarity-decode** (packages/clarity-decode): Data decoder
- **clarity-visualize** (packages/clarity-visualize): Session replay visualization
- **clarity-devtools** (packages/clarity-devtools): Chrome extension (private)

**Stack:** TypeScript, Rollup, TSLint, Mocha/Chai, Lerna, Yarn workspaces

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

### Testing

```bash
yarn test                              # clarity-js only (ts-mocha + Chai, <1s)
cd packages/clarity-decode && yarn test  # clarity-decode (Mocha, auto-builds first)
```

Note: clarity-decode tests require build artifacts (automatic via pretest hook).

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
.github/workflows/npm-publish.yml  # CI/CD (currently disabled)
```

**Per-package configs:** `tsconfig.json` (ES5 target), `tslint.json`, `rollup.config.ts`, `package.json`

**Dependency chain:** clarity-js → clarity-decode → clarity-visualize → clarity-devtools. Changes to upstream packages may require rebuilding dependents.

## Versioning & Release

```bash
yarn bump-version                 # Patch (default)
yarn bump-version --part=minor    # Minor
yarn bump-version --part=major    # Major
```

Updates `version.ts`, all `package.json`, `lerna.json`, and stages files. Then commit, push, create PR. (Note: Auto-publish workflow currently disabled)

## CI/CD Pipeline

**Workflow:** `.github/workflows/npm-publish.yml` (currently disabled - build job has `if: false`, blocks publish)
- **Trigger:** Master push with `version.ts` changes
- **Build job:** Node 22.17.0 - install, build, test, size checks (<2% growth vs previous)
- **Publish job:** Node 18.20.6 - publishes 3 packages to npm, creates git tag

## Environment

**Node.js:** 18+ required (workflow: 18.20.6 publish, 22.17.0 build)
**Package manager:** Yarn only (has yarn.lock, uses workspaces) - install globally: `npm i -g yarn`

## Common Issues

1. **Build fails:** Run `yarn install` first after clone/pull
2. **clarity-decode tests fail:** Needs build artifacts (auto-builds via pretest)
3. **Peer dependency warnings:** Expected and safe to ignore
4. **TSLint errors:** Only fix your changes, use `yarn tslint:fix` for formatting
5. **clarity-js changes not reflected:** Rebuild all with `yarn build` from root

## Making Changes

**Workflow:** `yarn install` → make changes → `yarn build` → `yarn test` → lint modified files
- If changing clarity-js APIs used by other packages, rebuild all from root
- Follow TSLint rules: typedefs required, max 140 chars, `let`/`const` only, `as` assertions
- Build configs in `rollup.config.ts` generate multiple formats (CJS, ESM, IIFE)

**Import style for clarity-js:**
- Use `@src/<path>` aliases for cross-module imports (e.g., `from "@src/data/cookie"`, `from "@src/data/metadata"`)
- Exception: `encode.ts` files use relative imports (e.g., `from "./encode"`)

**Trust these instructions** - validated by testing. Only search if you need specifics not covered here or encounter undocumented errors.
