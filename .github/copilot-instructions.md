# Clarity Repository - Copilot Agent Instructions

## Repository Overview

Clarity is an open-source behavioral analytics library written in TypeScript that tracks user interactions and generates session replays. The repository is a monorepo managed with Lerna and Yarn workspaces containing 4 packages:

- **clarity-js** (packages/clarity-js): Core instrumentation library that tracks user interactions
- **clarity-decode** (packages/clarity-decode): Decoder for Clarity data payloads
- **clarity-visualize** (packages/clarity-visualize): Session replay visualization library
- **clarity-devtools** (packages/clarity-devtools): Chrome DevTools extension (private package)

**Technology Stack:** TypeScript, Rollup (bundler), TSLint, Mocha/Chai (testing), Lerna (monorepo), Yarn workspaces

## Build & Development Commands

### Installation
**ALWAYS run `yarn install` before any build or test commands.** This installs all dependencies across all workspace packages.

```bash
yarn install
```

Expected time: 20-30 seconds. Warnings about unmet peer dependencies are normal and can be ignored.

### Building

**Full build (all packages):**
```bash
yarn build
```
Expected time: 45-50 seconds. This uses Lerna to build all 4 packages in parallel. Build artifacts are placed in `build/` or `extension/` directories (already in .gitignore).

**Individual package builds:**
```bash
yarn build:js          # Build clarity-js only (~20s)
yarn build:decode      # Build clarity-decode only
yarn build:visualize   # Build clarity-visualize only
yarn build:devtools    # Build clarity-devtools only
```

**Build process:** Each package uses Rollup with TypeScript plugin. Build compiles TypeScript to multiple output formats (CommonJS, ES modules, IIFE with minification).

**Important:** Build artifacts are automatically cleaned before each build via `del-cli build/*` or `del-cli extension/*`.

### Testing

**Run tests:**
```bash
yarn test
```
This runs tests only for `clarity-js` package (uses ts-mocha). Expected time: <1 second.

**clarity-decode tests:**
```bash
cd packages/clarity-decode && yarn test
```
Note: clarity-decode tests have a `pretest` script that automatically runs `yarn build` first. The tests require the built artifacts.

**Test framework:** clarity-js uses ts-mocha with Chai assertions. clarity-decode uses plain Mocha.

### Linting

**Check linting (at package level):**
```bash
cd packages/clarity-js && yarn tslint
cd packages/clarity-decode && yarn tslint
cd packages/clarity-visualize && yarn tslint
cd packages/clarity-devtools && yarn tslint
```

**Auto-fix linting issues:**
```bash
cd packages/<package-name> && yarn tslint:fix
```

**Important:** The codebase has existing TSLint errors. Do not fix unrelated linting errors unless specifically instructed. The project uses TSLint (not ESLint) with custom rules defined in each package's `tslint.json`.

**Common linting rules:**
- Max line length: 140 characters
- Requires typedefs on function signatures, parameters, properties
- Forbids `var` keyword (use `let` or `const`)
- Forbids angle-bracket type assertions (use `as` syntax)

## Project Architecture

### Monorepo Structure
```
/
├── packages/
│   ├── clarity-js/          # Core tracking library (main package)
│   │   ├── src/
│   │   │   ├── core/        # Core functionality, config, events
│   │   │   ├── layout/      # DOM tracking, mutations, style
│   │   │   ├── interaction/ # User interactions (clicks, input)
│   │   │   ├── performance/ # Performance metrics
│   │   │   ├── data/        # Data collection
│   │   │   ├── diagnostic/  # Error tracking
│   │   │   ├── insight/     # Analytics insights
│   │   │   └── dynamic/     # Dynamic agent integrations
│   │   ├── test/            # Mocha tests with ts-mocha
│   │   ├── build/           # Build output (gitignored)
│   │   ├── types/           # TypeScript type definitions
│   │   ├── rollup.config.ts # Build configuration
│   │   ├── tsconfig.json    # TypeScript config
│   │   └── tslint.json      # Linting rules
│   ├── clarity-decode/      # Decoding library
│   ├── clarity-visualize/   # Visualization library
│   └── clarity-devtools/    # DevTools extension
├── scripts/
│   ├── bump-version.ts      # Version bumping script (uses ts-node)
│   └── check-file-size.sh   # Bundle size validation
├── .github/workflows/
│   └── npm-publish.yml      # CI/CD pipeline (currently disabled)
├── lerna.json               # Lerna configuration
└── package.json             # Root package.json with workspace config
```

### Key Files

**Version file:** `packages/clarity-js/src/core/version.ts` - Single source of truth for version number. The bump-version script updates this file and all package.json files.

**Configuration files per package:**
- `tsconfig.json` - TypeScript compiler options (target: ES5, module: esnext)
- `tslint.json` - Linting rules
- `rollup.config.ts` - Build configuration with multiple output formats
- `package.json` - Package metadata and scripts

### Dependencies Between Packages
- clarity-decode depends on clarity-js
- clarity-visualize depends on clarity-decode
- clarity-devtools depends on all three packages

**Important:** When making changes to clarity-js, you may need to rebuild clarity-decode and clarity-visualize if they consume the changed APIs.

## Versioning & Release Process

**Bump version:**
```bash
yarn bump-version              # Bumps patch version (default)
yarn bump-version --part=minor # Bumps minor version
yarn bump-version --part=major # Bumps major version
```

This script (scripts/bump-version.ts):
1. Updates version in `packages/clarity-js/src/core/version.ts`
2. Updates version in all package.json files and lerna.json
3. Updates cross-package dependencies to match new version
4. Stages changed files with git

**After bumping:** Commit the changes, push, and create a PR. The GitHub Actions workflow publishes to npm automatically after merge to master (though the build job is currently disabled with `if: false`).

## CI/CD Pipeline

**Workflow:** `.github/workflows/npm-publish.yml`
- **Trigger:** Push to master branch with changes to `packages/clarity-js/src/core/version.ts`
- **Status:** Currently non-functional - the build job is disabled with `if: false`, and since the publish job depends on it with `needs: build`, the entire workflow is effectively disabled
- **Build job (when enabled):** Would run on Node.js 22.17.0
  - yarn install
  - yarn build
  - yarn test
  - File size checks for each package
- **Publish job (when enabled):** Would run on Node.js 18.20.6 after successful build
  - Publishes clarity-js, clarity-decode, clarity-visualize to npm
  - Creates git tag for the release

**File size checks:** The script `scripts/check-file-size.sh` validates that bundle sizes don't grow beyond threshold (2%) compared to previous version.

## Development Environment

**Node.js version:** Node.js 18+ required (workflow uses 18.20.6 for publish, 22.17.0 for build)
**Package manager:** Yarn (not npm) - the project uses yarn.lock and Yarn workspaces
**Required global tools:** Yarn (`npm i -g yarn`)

## Common Issues & Solutions

**Issue:** `yarn build` fails with missing dependencies
**Solution:** Always run `yarn install` first after cloning or pulling changes.

**Issue:** Tests fail in clarity-decode
**Solution:** clarity-decode tests require build artifacts. The `yarn test` command in clarity-decode automatically runs `yarn build` first via pretest hook.

**Issue:** Warnings about unmet peer dependencies during `yarn install`
**Solution:** These warnings are expected and can be safely ignored. They relate to optional peer dependencies.

**Issue:** TSLint errors during development
**Solution:** The codebase has existing linting errors. Only fix errors you introduced. Use `yarn tslint:fix` to auto-fix formatting issues.

**Issue:** Changes to clarity-js not reflected in other packages
**Solution:** Rebuild all packages with `yarn build` from root, not individual packages.

## Making Code Changes

1. **Always run `yarn install` before starting work**
2. Make your code changes
3. **Build affected packages:** `yarn build` (or individual package builds)
4. **Run tests:** `yarn test`
5. **Check linting only for files you modified:** `cd packages/<package> && yarn tslint`
6. If adding new features to clarity-js that other packages use, rebuild all packages

**When modifying TypeScript files:**
- Follow existing TSLint rules (see tslint.json)
- Add typedefs to function signatures and parameters
- Keep lines under 140 characters
- Use `let` or `const`, never `var`
- Use `as` syntax for type assertions, not `<>`

**When changing build configuration:**
- Modify rollup.config.ts in the relevant package
- Test build with `yarn build` to ensure no errors
- Be aware that multiple output formats are generated (CJS, ESM, IIFE)

## Trust These Instructions

These instructions have been validated by running all commands and analyzing the codebase structure. Only perform additional searches if:
- You need to locate a specific function or code pattern not covered here
- The instructions are incomplete for your specific task
- You encounter an error not described in the "Common Issues" section

Follow these instructions to work efficiently with minimal exploration and command failures.
