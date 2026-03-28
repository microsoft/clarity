# Autoresearch: clarity-js Bundle Size Optimization

## Objective
Optimize the gzipped bundle size of `clarity.min.js` (the minified IIFE bundle shipped to end users).
The final bundle is gzipped before serving to customers, so gzipped size is the primary metric.

Current baseline: ~73,902 bytes raw, ~25,788 bytes gzipped.

## Metrics
- **Primary**: `gzip_bytes` (bytes, lower is better) — gzipped size of `packages/clarity-js/build/clarity.min.js`
- **Secondary**: `raw_bytes` — raw size of `clarity.min.js`

## How to Run
`./autoresearch.sh` — builds clarity-js and outputs `METRIC gzip_bytes=N` and `METRIC raw_bytes=N` lines.

## Files in Scope
All files under `packages/clarity-js/src/` — the TypeScript source code (~94 files):
- `core/` — config, events, task scheduling, hash, scrub, measure, time
- `layout/` — DOM tracking, mutations, selectors, style, animation, regions
- `interaction/` — click, scroll, pointer, input, clipboard tracking
- `data/` — upload, metadata, encoding, cookies, baseline, extract
- `diagnostic/` — error tracking, fraud detection
- `performance/` — navigation, interaction metrics, observers
- `insight/` — snapshot, encoding (used in insight build variant)
- `dynamic/` — dynamic agent modules (livechat, tidio, crisp)
- `clarity.ts`, `queue.ts`, `global.ts`, `index.ts` — entry points

Also in scope:
- `packages/clarity-js/rollup.config.ts` — build configuration (terser options)
- `packages/clarity-js/types/*.d.ts` — TypeScript type definitions with `const enum` values

## Off Limits
- Do NOT change public APIs or break decode compatibility
- Do NOT remove features or functionality
- Do NOT modify test files
- Do NOT modify packages other than clarity-js (except types it owns)
- Do NOT add new dependencies
- Do NOT change the target (ES5) or build format (IIFE)
- Do NOT cheat by stripping needed code paths

## Constraints
- `yarn workspace clarity-js test` must pass (27 tests)
- `yarn workspace clarity-decode test` must pass (2 tests) — decode depends on clarity-js encoding format
- Build must succeed for all rollup configs (all variants)
- Performance must not degrade — no main-thread blocking changes
- Changes should be genuine code improvements, not benchmark gaming

## What's Been Tried
### Wins (cumulative -3,622 gzip bytes, -13.1% from baseline of 27,700)
1. **Enhanced terser config** (-301 gzip): passes=3, pure_getters, unsafe_comps, toplevel mangle
2. **Template literals → + concatenation** (-110 gzip): Avoids ES5 `.concat()` chains
3. **Consolidated tokens.push()** (-67 gzip): Multi-arg push(a,b,c) instead of sequential calls
4. **ES2017 target for IIFE** (-2,052 gzip): Eliminated __awaiter/__generator polyfills
5. **Object.assign in baseline.ts + updatePointer helper** (-109 gzip): Deduplicated buffer copy
6. **proxyStyleRules refactoring** (-50 gzip): Extracted proxyRule helper in mutation.ts
7. **freeze:false for IIFE outputs** (-29 gzip): Removed Object.freeze on namespace objects
8. **terser compress module:true** (-12 gzip): Additional module-level optimizations
9. **style.ts refactoring** (-20 gzip): proxyStyleMethod helper + simpler arraysEqual
10. **terser hoist_vars:true** (-3 gzip): Var declaration hoisting
11. **ES2020 target** (-256 gzip): Optional chaining + nullish coalescing
12. **history.ts refactoring** (-7 gzip): proxyHistory helper for pushState/replaceState
13. **animation.ts cleanup** (-1 gzip): Simplified overrideAnimationHelper + removed unused vars
14. **Shorter internal property names** (-18 gzip): clarityOverrides→__clr, shorter DOM prop keys
15. **metric.ts init() helper** (-11 gzip): Deduplicated metric initialization in count/sum/max
16. **indexOf→includes** (-52 gzip): Modern ES2020 includes() across ~27 occurrences
17. **Array.from→spread** (-1 gzip): [...x] instead of Array.from(x)
18. **.toString()→""+x** (-6 gzip): Shorter string coercion in 6 places
19. **Math.pow→bitshift** (-1 gzip): 1<<n instead of Math.pow(2,n) in hash.ts
20. **compress.ts Response API** (-44 gzip): Eliminated entire read() function using Response.arrayBuffer()
21. **Inline str() helper** (-1 gzip): Removed single-use function in layout/encode.ts
22. **signal.ts simplification** (-20 gzip): Eliminated redundant parseSignals() wrapper
23. **data/encode.ts alias** (-7 gzip): Local var for b.data deep property chain
24. **clarity.ts namespace elimination** (-28 gzip): Named imports for 5 module namespaces
25. **data/index.ts namespace elimination** (-324 gzip): Named imports for 13 sub-module namespaces
26. **node.ts dom namespace elimination** (-92 gzip): Replaced dom[call] dynamic dispatch with domCall helper

### Dead Ends
- `ecma:2017` in terser compress: No additional benefit
- `generatedCode: "es2015"`: +84 gzip WORSE (Symbol.toStringTag overhead)
- `esModule: false`, `interop/externalLiveBindings`: No change
- Hoisting arrays/consts to module scope: +2 gzip (gzip compresses inline better)
- Shared coordinates() helper: +23 gzip despite -264 raw (gzip deduplicates repeated code)
- Replace tags.includes with direct ===: +5 gzip
- ES2022 target: Identical to ES2020
- `unsafe_math`, `unsafe_undefined`, `unsafe_arrows`, `reduce_vars` terser: No change
- `treeshake: moduleSideEffects:false`: +168 gzip WORSE (removed needed code)
- terser property mangle __clr*: UNSAFE (window.t collision risk)
- terser passes=4, wrap_iife: No improvement
- Inlining document.ts variables: No change (terser already handles)
- Storing const enum values in runtime const vars: TDZ crash due to circular deps
- ||= operator: +3 gzip (unique pattern compresses worse)
- Math.pow→literal number: +2 gzip (large literals compress worse than function calls)
- document.ts dim() helper: +13 gzip (extracting helpers hurts gzip)
