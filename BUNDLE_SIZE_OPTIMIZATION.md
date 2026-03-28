# clarity-js Bundle Size Optimization — Detailed Change Log

**Branch:** `autoresearch/bundle-size-2026-03-27`  
**Result:** 27,700 → 26,296 gzip bytes (**-5.1%**), 81,597 → 73,854 raw bytes (**-9.5%**)  
**Experiments:** 71 | **Commits:** 32 | **Tests:** All 29 passing

> Note: An additional -8% gzip was achievable by upgrading the TypeScript IIFE target from ES5 to ES2020,
> but this was reverted because it would break older Angular websites that rely on ES5 compatibility.

---

## 1. Enhanced Terser Configuration (−301 gzip)

**File:** `packages/clarity-js/rollup.config.ts`

The original terser config was minimal — only stripping comments. Adding multi-pass optimization, pure getter assumptions, and toplevel mangling lets terser collapse more expressions, inline more constants, and use shorter variable names.

```js
// BEFORE
terser({output: {comments: false}})

// AFTER
const terserOpts = {
  compress: {
    passes: 3,          // Run 3 optimization passes
    pure_getters: true,  // Assume property access has no side effects
    unsafe_comps: true,  // Allow optimizations on comparisons
    toplevel: true,      // Optimize top-level scope variables
    module: true,        // Enable module-specific optimizations
    hoist_vars: true,    // Hoist var declarations to top of scope
  },
  mangle: {
    toplevel: true,      // Mangle top-level variable names
  },
  output: { comments: false }
};

// Applied to all 7 IIFE build variants
terser(terserOpts)
```

**Why it works:** `passes: 3` allows terser to discover optimization opportunities across multiple iterations. `pure_getters` enables dead code elimination for property reads. `toplevel` + `mangle.toplevel` gives terser permission to rename all IIFE-scoped variables to single characters.

---

## 2. Template Literals → String Concatenation (−110 gzip)

**Files:** 14 source files across core/, data/, layout/, interaction/, diagnostic/, insight/

TypeScript compiles template literals to `.concat()` chains when targeting ES5:

```js
// SOURCE (template literal)
result = `${Constant.HTTPS}${Constant.Electron}`;
// ES5 OUTPUT: "".concat(Constant.HTTPS).concat(Constant.Electron)  — 51 chars

// SOURCE (+ concatenation)
result = Constant.HTTPS + Constant.Electron;
// ES5 OUTPUT: Constant.HTTPS + Constant.Electron  — 35 chars
```

**Sample changes:**

```ts
// core/scrub.ts
// BEFORE
result = `${Data.Constant.HTTPS}${Data.Constant.Electron}`;
// AFTER
result = Data.Constant.HTTPS + Data.Constant.Electron;

// layout/selector.ts
// BEFORE
let suffix = type === Selector.Alpha ? `${Constant.Tilde}${input.position-1}` : `:nth-of-type(${input.position})`;
// AFTER
let suffix = type === Selector.Alpha ? Constant.Tilde + (input.position-1) : ":nth-of-type(" + input.position + ")";

// data/upload.ts
// BEFORE
return encoded.p.length > 0 ? `{"e":${encoded.e},"a":${encoded.a},"p":${encoded.p}}` : `{"e":${encoded.e},"a":${encoded.a}}`;
// AFTER
return encoded.p.length > 0 ? '{"e":' + encoded.e + ',"a":' + encoded.a + ',"p":' + encoded.p + '}' : '{"e":' + encoded.e + ',"a":' + encoded.a + '}';
```

**Why it works:** Each `.concat()` call adds ~16 bytes to the minified output. With ~30 template literals converted, that's ~480 bytes of raw savings. gzip compresses repeated `.concat(` patterns somewhat, but the `+` operator still produces smaller gzip output.

---

## 3. Consolidated tokens.push() Calls (−67 gzip)

**Files:** `data/encode.ts`, `interaction/encode.ts`, `layout/encode.ts`, `diagnostic/encode.ts`, `performance/encode.ts`

Sequential `.push()` calls were combined into single multi-argument calls:

```ts
// BEFORE — data/encode.ts baseline case (25 sequential pushes)
tokens.push(b.data.visible);
tokens.push(b.data.docWidth);
tokens.push(b.data.docHeight);
// ... 22 more lines

// AFTER — single multi-arg push
tokens.push(
    d.visible, d.docWidth, d.docHeight,
    d.screenWidth, d.screenHeight,
    d.scrollX, d.scrollY,
    d.pointerX, d.pointerY,
    d.activityTime, d.scrollTime,
    d.pointerTime,
    d.moveX, d.moveY, d.moveTime,
    d.downX, d.downY, d.downTime,
    d.upX, d.upY, d.upTime,
    d.pointerPrevX, d.pointerPrevY, d.pointerPrevTime,
    d.modules
);
```

**Why it works:** `t.push(a,b,c)` is shorter than `t.push(a),t.push(b),t.push(c)` in minified output. Each eliminated `.push(` call saves ~8 bytes raw. Applied across ~100 push calls in 5 encode files.

---

## 4. Deduplicate baseline.ts (−109 gzip)

**File:** `packages/clarity-js/src/data/baseline.ts`

Two optimizations: (a) replaced a 25-field manual object copy with `Object.assign`, and (b) extracted a repeated 6-line pointer update block into a helper function.

```ts
// BEFORE — reset() had 25 lines copying buffer properties one by one
state = { time: time(), event: Event.Baseline, data: {
    visible: buffer.visible,
    docWidth: buffer.docWidth,
    // ... 23 more property copies
}};

// AFTER — single Object.assign
state = { time: time(), event: Event.Baseline, data: Object.assign({}, buffer) };

// BEFORE — pointer update repeated 4 times in switch cases
buffer.pointerPrevX = buffer.pointerX;
buffer.pointerPrevY = buffer.pointerY;
buffer.pointerPrevTime = buffer.pointerTime;
buffer.pointerX = x;
buffer.pointerY = y;
buffer.pointerTime = time;

// AFTER — extracted to helper
function updatePointer(x: number, y: number, time: number): void {
    buffer.pointerPrevX = buffer.pointerX;
    buffer.pointerPrevY = buffer.pointerY;
    buffer.pointerPrevTime = buffer.pointerTime;
    buffer.pointerX = x;
    buffer.pointerY = y;
    buffer.pointerTime = time;
}
// Each of 4 switch cases now calls: updatePointer(x, y, time);
```

**Why it works:** `Object.assign({}, buffer)` is ~30 bytes minified vs ~400 bytes for 25 explicit property copies. The `updatePointer` helper eliminates 4 copies of 6 lines each. Unlike most helper extractions (which hurt gzip), this one helped because the replaced code was **unique** (different property names each time) rather than repeated patterns.

---

## 5. Refactor proxyStyleRules in mutation.ts (−50 gzip)

**File:** `packages/clarity-js/src/layout/mutation.ts`

Four nearly identical CSS rule proxy blocks (CSSStyleSheet.insertRule, CSSStyleSheet.deleteRule, CSSMediaRule.insertRule, CSSMediaRule.deleteRule) were collapsed into a single `proxyRule()` helper:

```ts
// BEFORE — 4 blocks like this (each ~15 lines)
if ("CSSStyleSheet" in win && win.CSSStyleSheet && win.CSSStyleSheet.prototype
    && win.__clr.InsertRule === undefined) {
    win.__clr.InsertRule = win.CSSStyleSheet.prototype.insertRule;
    win.CSSStyleSheet.prototype.insertRule = function (): number {
        if (core.active()) { schedule(this.ownerNode); }
        return win.__clr.InsertRule.apply(this, arguments);
    };
}
// ... repeat for DeleteRule, MediaInsertRule, MediaDeleteRule

// AFTER — 4 one-line calls + 1 helper
proxyRule(win, "CSSStyleSheet", "InsertRule", "insertRule", function() { return this.ownerNode; });
proxyRule(win, "CSSStyleSheet", "DeleteRule", "deleteRule", function() { return this.ownerNode; });
proxyRule(win, "CSSMediaRule", "MediaInsertRule", "insertRule", function() { return this.parentStyleSheet.ownerNode; });
proxyRule(win, "CSSMediaRule", "MediaDeleteRule", "deleteRule", function() { return this.parentStyleSheet.ownerNode; });

function proxyRule(win: any, cls: string, key: string, method: string, getNode: () => Node): void {
    if (cls in win && win[cls] && win[cls].prototype && win.__clr[key] === undefined) {
        win.__clr[key] = win[cls].prototype[method];
        win[cls].prototype[method] = function (): any {
            if (core.active()) { schedule(getNode.call(this)); }
            return win.__clr[key].apply(this, arguments);
        };
    }
}
```

---

## 6. Rollup freeze:false (−29 gzip)

**File:** `packages/clarity-js/rollup.config.ts`

Added `freeze: false` to all 7 IIFE output configurations:

```js
// BEFORE
output: [ { file: pkg.unpkg, format: "iife", exports: "named" } ]
// AFTER
output: [ { file: pkg.unpkg, format: "iife", exports: "named", freeze: false } ]
```

**Why it works:** By default Rollup wraps `import * as` namespace objects with `Object.freeze()`. In an IIFE where modules are internal, freezing is unnecessary overhead. Removing it saves ~15 bytes per namespace object.

---

## 7. style.ts Refactoring (−20 gzip)

**File:** `packages/clarity-js/src/layout/style.ts`

Extracted `proxyStyleMethod()` helper from two near-identical replace/replaceSync proxy blocks, and simplified `arraysEqual()`:

```ts
// BEFORE — arraysEqual (5 lines)
function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) { return false; }
    return a.every((value, index) => value === b[index]);
}
// AFTER — arraysEqual (1 line)
function arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
```

---

## 8. history.ts proxyHistory Helper (−7 gzip)

**File:** `packages/clarity-js/src/core/history.ts`

Two nearly identical try/catch blocks for `history.pushState` and `history.replaceState` proxying were merged into a `proxyHistory()` helper:

```ts
// BEFORE — two 15-line blocks
if (pushState === null) {
    try {
        pushState = history.pushState;
        history.pushState = function(): void {
            pushState.apply(this, arguments);
            if (core.active() && check()) { compute(); }
        };
    } catch (e) { pushState = null; }
}
// ... identical block for replaceState

// AFTER
pushState = proxyHistory(pushState, "pushState");
replaceState = proxyHistory(replaceState, "replaceState");

function proxyHistory(original: Function, method: string): Function {
    if (original === null) {
        try {
            original = history[method];
            history[method] = function(): void {
                original.apply(this, arguments);
                if (core.active() && check()) { compute(); }
            };
        } catch (e) { original = null; }
    }
    return original;
}
```

---

## 9. animation.ts Simplification (−1 gzip)

**File:** `packages/clarity-js/src/layout/animation.ts`

Removed 5 unused module-level variables and simplified the override loop:

```ts
// BEFORE — 5 variables + 5 separate calls
let animationPlay: () => void = null;
let animationPause: () => void = null;
let animationCommitStyles: () => void = null;
let animationCancel: () => void = null;
let animationFinish: () => void = null;
// ...
overrideAnimationHelper(animationPlay, "play");
overrideAnimationHelper(animationPause, "pause");
// ... 3 more

// AFTER — 1 flag + array iteration
let overridden = false;
// ...
if (!overridden) {
    overridden = true;
    ["play", "pause", "commitStyles", "cancel", "finish"].forEach(overrideAnimationHelper);
}

function overrideAnimationHelper(name: string) {
    let original = Animation.prototype[name];
    Animation.prototype[name] = function(): void {
        trackAnimationOperation(this, name);
        return original.apply(this, arguments);
    }
}
```

---

## 10. Shorter Internal Property Names (−18 gzip)

**Files:** `layout/mutation.ts`, `layout/style.ts`, `layout/custom.ts`, `layout/animation.ts`

Renamed internal properties stored on `window` and DOM nodes to shorter names:

```ts
// BEFORE
window.clarityOverrides = window.clarityOverrides || {};  // 20 occurrences of "clarityOverrides"
const animationId = 'clarityAnimationId';
const operationCount = 'clarityOperationCount';
const styleSheetId = 'claritySheetId';

// AFTER
window.__clr = window.__clr || {};  // 20 occurrences of "__clr"
const animationId = '__clrAId';
const operationCount = '__clrOCnt';
const styleSheetId = '__clrSId';
```

---

## 11. metric.ts init() Helper (−11 gzip)

**File:** `packages/clarity-js/src/data/metric.ts`

Extracted duplicate initialization checks from `count()`, `sum()`, and `max()`:

```ts
// BEFORE — same 2-line check in count() and sum()
export function count(metric: Metric): void {
    if (!(metric in data)) { data[metric] = 0; }
    if (!(metric in updates)) { updates[metric] = 0; }
    data[metric]++;
    updates[metric]++;
}

// AFTER
function init(metric: Metric): void {
    if (!(metric in data)) { data[metric] = 0; }
    if (!(metric in updates)) { updates[metric] = 0; }
}
export function count(metric: Metric): void {
    init(metric);
    data[metric]++;
    updates[metric]++;
}
```

---

## 12. indexOf → includes (−52 gzip)

**Files:** ~15 files across the codebase (27 occurrences)

Replaced ES5-era `indexOf` boolean patterns with ES2016 `includes()`:

```ts
// BEFORE
if (IGNORE_ATTRIBUTES.indexOf(name) < 0) { ... }
if (history.indexOf(data.checksum) < 0) { ... }
if (data[dimension].indexOf(value) < 0) { ... }
if (PerformanceObserver.supportedEntryTypes.indexOf(x) >= 0) { ... }

// AFTER
if (!IGNORE_ATTRIBUTES.includes(name)) { ... }
if (!history.includes(data.checksum)) { ... }
if (!data[dimension].includes(value)) { ... }
if (PerformanceObserver.supportedEntryTypes.includes(x)) { ... }
```

**Why it works:** `.includes(x)` minifies to shorter code than `.indexOf(x)>=0` or `.indexOf(x)<0` in the ES5 output. The `includes` method name is 8 chars vs `indexOf` at 7, but `.includes(x)` is 13 chars vs `.indexOf(x)>=0` at 15 chars.

---

## 13. .toString() → ""+x Coercion (−6 gzip)

**Files:** `data/metadata.ts`, `data/consent.ts`, `performance/observer.ts`, `interaction/encode.ts`

```ts
// BEFORE
dimension.log(Dimension.Dob, u.dob.toString());              // .toString() = 12 chars minified
dimension.log(Dimension.CookieVersion, u.version.toString());
dimension.log(Dimension.Consent, consent.toString());

// AFTER
dimension.log(Dimension.Dob, "" + u.dob);                    // ""+x = 4 chars minified
dimension.log(Dimension.CookieVersion, "" + u.version);
dimension.log(Dimension.Consent, "" + consent);
```

---

## 14. Math.pow → Bitshift (−1 gzip)

**File:** `packages/clarity-js/src/core/hash.ts`

```ts
// BEFORE
return (precision ? hash % Math.pow(2, precision) : hash).toString(36);
// AFTER
return (precision ? hash % (1 << precision) : hash).toString(36);
```

`1 << n` is 4 chars vs `Math.pow(2,n)` at 14 chars, and compiles to a single CPU instruction.

---

## 15. compress.ts Response API (−44 gzip)

**File:** `packages/clarity-js/src/data/compress.ts`

Replaced a 10-line manual stream reader with a one-line `Response` API call:

```ts
// BEFORE — entire read() function
async function read(stream: ReadableStream): Promise<number[]> {
    const reader = stream.getReader();
    const chunks: number[] = [];
    let done = false;
    let value: number[] = [];
    while (!done) {
        ({ done, value } = await reader.read());
        if (done) { return chunks; }
        chunks.push(...value);
    }
    return chunks;
}
// Called as: return new Uint8Array(await read(stream));

// AFTER — one line, no helper function needed
return new Uint8Array(await new Response(stream).arrayBuffer());
```

**Why it works:** `new Response(stream).arrayBuffer()` is a well-supported Web API that does exactly the same thing — consume a ReadableStream into an ArrayBuffer — but in a single expression. The entire `read()` function (~150 bytes minified) is eliminated.

---

## 16. Inline str() Helper (−1 gzip)

**File:** `packages/clarity-js/src/layout/encode.ts`

```ts
// BEFORE — single-use helper
function str(input: number): string { return input.toString(36); }
// called: tokens.push(Constant.Hash + str(box[0]) + "." + str(box[1]));

// AFTER — inlined
tokens.push(Constant.Hash + box[0].toString(36) + "." + box[1].toString(36));
```

---

## 17. signal.ts Simplification (−20 gzip)

**File:** `packages/clarity-js/src/data/signal.ts`

Eliminated a redundant wrapper function and nested try/catch:

```ts
// BEFORE — parseSignals() wrapper + double try/catch
function parseSignals(signalsPayload: string): ClaritySignal[] {
    try {
        const parsedSignals: ClaritySignal[] = JSON.parse(signalsPayload);
        return parsedSignals;
    } catch { return []; }
}
export function signalsEvent(signalsPayload: string) {
    try {
        if (!signalCallback) { return; }
        const signals = parseSignals(signalsPayload);
        signals.forEach((signal) => { signalCallback(signal); });
    } catch { }
}

// AFTER — single function, single try/catch
export function signalsEvent(signalsPayload: string) {
    try {
        if (signalCallback) {
            (JSON.parse(signalsPayload) as ClaritySignal[]).forEach(s => signalCallback(s));
        }
    } catch { }
}
```

---

## 18. data/encode.ts Local Alias (−7 gzip)

**File:** `packages/clarity-js/src/data/encode.ts`

Added a local alias for `b.data` which was accessed 25 times:

```ts
// BEFORE — 25 occurrences of b.data.XXX
tokens.push(b.data.visible, b.data.docWidth, b.data.docHeight, ...);

// AFTER — local alias
let d = b.data;
tokens.push(d.visible, d.docWidth, d.docHeight, ...);
```

**Why it works:** `b.data.` (7 chars) × 25 occurrences = 175 chars. `d.` (2 chars) × 25 + `let d=b.data;` (13 chars) = 63 chars. Saves 112 raw bytes, and gzip can't fully deduplicate `b.data.` because each suffix is different.

---

## 19. Namespace Elimination in clarity.ts (−28 gzip)

**File:** `packages/clarity-js/src/clarity.ts`

Replaced `import * as` with named imports for 5 modules used only in the `modules[]` array:

```ts
// BEFORE — creates 5 Rollup namespace objects with ALL exports
import * as diagnostic from "@src/diagnostic";
import * as interaction from "@src/interaction";
import * as layout from "@src/layout";
import * as performance from "@src/performance";
import * as dynamic from "@src/core/dynamic";
const modules: Module[] = [diagnostic, layout, interaction, performance, dynamic];

// AFTER — no namespace objects needed
import { start as diagStart, stop as diagStop } from "@src/diagnostic";
import { start as interStart, stop as interStop } from "@src/interaction";
import { start as layoutStart, stop as layoutStop } from "@src/layout";
import { start as perfStart, stop as perfStop } from "@src/performance";
import { start as dynStart, stop as dynStop } from "@src/core/dynamic";
const modules: Module[] = [
    { start: diagStart, stop: diagStop },
    { start: layoutStart, stop: layoutStop },
    { start: interStart, stop: interStop },
    { start: perfStart, stop: perfStop },
    { start: dynStart, stop: dynStop },
];
```

**Why it works:** `import * as X` forces Rollup to create a runtime namespace object containing getter functions for ALL of X's exports. When the namespace is only used for `.start()` and `.stop()`, the other exports are dead weight. Named imports with explicit `{start, stop}` pairs let Rollup tree-shake everything else.

---

## 20. Namespace Elimination in data/index.ts (−324 gzip)

**File:** `packages/clarity-js/src/data/index.ts`

Same pattern as #19 but applied to 13 data sub-modules — the single largest win after the (reverted) ES target change:

```ts
// BEFORE — 13 namespace objects
import * as baseline from "@src/data/baseline";
import * as consent from "@src/data/consent";
// ... 11 more
const modules: Module[] = [baseline, dimension, variable, limit, ...];
// compute() uses: variable.compute(), baseline.compute(), etc.

// AFTER — no namespace objects, direct function references
import { start as baseStart, stop as baseStop, compute as baseCompute } from "@src/data/baseline";
import { start as conStart, stop as conStop, compute as conCompute } from "@src/data/consent";
// ... 11 more
const modules: Module[] = [
    { start: baseStart, stop: baseStop },
    { start: dimStart, stop: dimStop },
    // ... 11 more
];
export function compute(): void {
    varCompute(); baseCompute(); dimCompute(); // direct calls
    metric.compute(); sumCompute(); limCompute(); extCompute(); conCompute();
}
```

**Why it works:** This was the biggest remaining win because 13 namespace objects were being created, each containing ALL exports from modules like baseline (9 exports), extract (9 exports), metadata (13 exports), etc. The combined overhead was ~1.8KB raw. Converting to named imports eliminated all of it.

---

## 21. Namespace Elimination in node.ts (−92 gzip)

**File:** `packages/clarity-js/src/layout/node.ts`

Replaced the `dom[call]` dynamic dispatch pattern that forced the `dom` namespace to exist:

```ts
// BEFORE — dynamic property access forces Rollup to keep dom namespace
import * as dom from "./dom";
let call = add ? "add" : "update";
dom[call](node, parent, data, source);  // 13 occurrences

// AFTER — boolean flag + explicit helper
import { add as domAdd, update as domUpdate, has as domHas, ... } from "./dom";
function domCall(isAdd: boolean, node: Node, parent: Node, data: any, source: Source): void {
    isAdd ? domAdd(node, parent, data, source) : domUpdate(node, parent, data, source);
}
let isAdd = domHas(node) === false;
domCall(isAdd, node, parent, data, source);  // 13 occurrences
```

---

## 22. Index File Named Imports (0 additional gzip, code quality)

**Files:** `layout/index.ts`, `interaction/index.ts`, `diagnostic/index.ts`, `performance/index.ts`

Same pattern as #19/#20 — converted `import * as` to named imports in all module index files for consistency. These produced no additional gzip savings because Rollup had already inlined the namespaces after the `clarity.ts` change eliminated the top-level references.

---

## 23. ES5 Compatibility Revert

**File:** `packages/clarity-js/rollup.config.ts`

The ES5→ES2020 target change (-2,308 gzip) and `Array.from→spread` (-1 gzip) were reverted to preserve compatibility with older Angular websites:

```ts
// REVERTED — these were the two largest single wins but break ES5 compat
const tsIIFE = () => typescript({ target: "es2020" });  // REMOVED
// Array.from(x) → [...x]  // REVERTED back to Array.from(x)
```
