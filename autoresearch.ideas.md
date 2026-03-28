# Autoresearch Ideas: clarity-js Bundle Size

## Key Insights
- **gzip deduplicates well**: Extracting shared code into helpers helps RAW but often NOT gzip
- **ES target upgrades are the biggest wins**: ES5→ES2017→ES2020 = -2,308 gzip combined
- **Namespace elimination is the second biggest win**: import * as + modules[] = -444 gzip total
- **Only namespaces used as VALUES create runtime overhead**: Rollup inlines property-only access
- **Eliminating whole unique functions helps gzip**: compress.ts read(), signal.ts parseSignals()
- **Modern API replacements help**: indexOf→includes, Array.from→spread, Response API
- **Property mangling is unsafe**: window-attached properties collide, DOM names overlap

## Exhausted Paths
- All terser compress/mangle options tested (15+ variants)
- All rollup output options explored (freeze, esModule, interop, generatedCode, etc.)
- Source-level: template literals, push consolidation, includes/spread/toString all done
- Namespace elimination: only 1 remains (clarity API, required for dynamic dispatch)
- Code dedup via helpers: consistently hurts gzip (gzip handles repetition well)
- ||= operator, semicolons:false, wrap_iife: all worse for gzip
- const enum → runtime const: TDZ crash from circular deps

## Only Remaining Paths (require significant effort/risk)
- Upgrade terser to latest (5.46 vs current 5.16 — needs dep change, not allowed)
- Use esbuild/swc as minifier (needs new dep, not allowed)
- requestIdleCallback polyfill removal (risky for Safari <16.4 users)
- Property mangling with comprehensive reserved list (high risk of breakage)
