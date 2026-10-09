const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const cp = require("child_process");
const zlib = require("zlib");
const { chromium, expect } = require("@playwright/test");

const repo = path.resolve(__dirname, "..", "..", "..");
const baseline = path.resolve(process.argv[2] || path.join(repo, "..", "clarity-js-page-headings"));
const output = path.resolve(process.argv[3] || path.join(os.tmpdir(), "clarity-headings-benchmark"));
const samples = Number(process.env.HEADING_BENCH_SAMPLES || 12);
assert.ok(Number.isInteger(samples) && samples > 0, "HEADING_BENCH_SAMPLES must be a positive integer");
const baselineSha = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: baseline, encoding: "utf8" }).trim();
assert.equal(baselineSha, "c2928d8af01279bc6560962f3e750592ef6d2afd", "Use the original PR commit as baseline");
fs.mkdirSync(output, { recursive: true });

const origin = "https://clarity.test/";
const endpoint = `${origin}collect`;
const mask = "\u2022";
const fixtures = [
    { name: "small", html: "<h1 data-clarity-unmask>Products <em>and services</em></h1><h2>Delivery</h2><h3>Returns</h3>" },
    { name: "typical", html: "<h1>Shopping guide</h1><h2>Delivery</h2><h3>Returns</h3>" +
        "<article><p>Ordinary page copy and product information.</p><span>Price 123</span></article>".repeat(350) },
    { name: "many-headings", html: "<h1> </h1><h2 data-clarity-mask>Private</h2>" +
        "<h3>Products</h3><h4>Delivery</h4><h5>Returns</h5>" + "<h2>Later heading</h2>".repeat(195) },
    { name: "long-sensitive", html: [1, 2, 3].map(level =>
        `<h${level}>${"Product 123 ".repeat(1800)}</h${level}>`).join("") },
    { name: "fragmented", html: "<h1 data-clarity-unmask>" + "<span>word </span>".repeat(2500) +
        "</h1><h2>Delivery</h2><h3>Returns</h3>" },
    { name: "masked-fragments", html: "<h1 data-clarity-unmask>Visible " +
        "<span data-clarity-mask>SECRETS</span>".repeat(1800) +
        " tail</h1><h2>Delivery</h2><h3>Returns</h3>" },
    { name: "empty-branches", html: "<h1>" + ("<span>".repeat(20) + "</span>".repeat(20)).repeat(100) +
        "</h1><h2>Delivery</h2><h3>Returns</h3>" },
    { name: "lean-lite", html: "<h1 data-clarity-unmask>Products</h1><h2>Delivery</h2>", config: { lean: true, lite: true } }
];
const variants = [
    { name: "original", root: baseline },
    { name: "encoder", root: repo }
];
const file = (root, relative) => path.join(root, "packages", "clarity-js", relative);
const bundles = Object.fromEntries(variants.map(variant =>
    [variant.name, fs.readFileSync(file(variant.root, "build\\clarity.min.js"), "utf8")]));

function headings(payloads) {
    const values = [];
    for (const payload of payloads) {
        for (const event of payload.a || []) {
            if (event[1] !== 1) continue;
            for (let i = 2; i < event.length; i += 2) {
                if (event[i] === 40) values.push(...event[i + 1]);
            }
        }
    }
    return [...new Set(values)];
}

function layoutCost(payloads) {
    let cost = 0;
    for (const payload of payloads) {
        for (const event of payload.a || []) {
            if (event[1] !== 0) continue;
            for (let i = 2; i < event.length; i += 2) {
                if (event[i] === 3) cost += event[i + 1];
            }
        }
    }
    return cost;
}

function hasDiscovery(payloads) {
    return payloads.some(payload => (payload.p || []).some(event => event[1] === 5));
}

function instrument(root) {
    let source = fs.readFileSync(file(root, "build\\clarity.js"), "utf8");
    const pattern = /function (text(?:\$[a-z0-9]+)?)\(value, hint, privacy[^)]*\) \{/;
    assert.match(source, pattern, "Find the real scrubber in the readable bundle");
    source = source.replace(pattern, match =>
        `${match} if (hint === "*T") { window.__headingCounts.scrubs++; }`);
    if (root === repo) {
        const prepare = source.indexOf("function prepare() {");
        const capture = source.indexOf("function captureText(");
        assert.ok(prepare >= 0 && capture > prepare, "Find preparation and capture functions");
        const body = source.slice(prepare, capture);
        const closing = body.lastIndexOf("}");
        source = source.slice(0, prepare) + body.slice(0, closing) +
            "window.__headingCounts.preparedIds = Object.keys(textPieces).length;\n" +
            body.slice(closing) + source.slice(capture);
    }
    return `(() => { var exports = {}; ${source}
        window.clarity = (command, ...args) => exports.clarity[command](...args);
    })();`;
}

async function runPage(browser, fixture, variant, diagnostic = false) {
    const page = await browser.newPage();
    const payloads = [];
    const errors = [];
    const blocked = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
        const request = route.request();
        if (request.url() === origin) {
            await route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>${fixture.html}</body></html>` });
        } else if (request.url() === endpoint) {
            payloads.push(JSON.parse(request.postData()));
            await route.fulfill({ status: payloads.length === 1 ? 200 : 204,
                contentType: "text/plain", body: payloads.length === 1 ? "HEADINGS\nACTION benchmark-ready" : "" });
        } else {
            blocked.push(request.url());
            await route.abort();
        }
    });
    try {
        await page.goto(origin);
        const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
        await page.evaluate(() => {
            Object.defineProperty(window, "CompressionStream", { value: undefined, configurable: true });
            window.__headingCounts = { scrubs: 0, preparedIds: 0 };
        });
        await page.addScriptTag({ content: diagnostic ? instrument(variant.root) : bundles[variant.name] });
        const startMs = await page.evaluate(settings => {
            const start = performance.now();
            window.clarity("start", { projectId: "synthetic", track: false, delay: 50,
                upload: settings.endpoint, ...settings.config,
                action: () => { window.__headingCounts.permissionSeen = true; } });
            return performance.now() - start;
        }, { endpoint, config: fixture.config || {} });
        const skipped = fixture.config && fixture.config.lean && fixture.config.lite;
        await expect.poll(() => layoutCost(payloads) > 0 && (skipped || hasDiscovery(payloads)),
            { timeout: 20000 }).toBe(true);
        await page.waitForFunction(() => window.__headingCounts.permissionSeen === true);
        await page.evaluate(() => window.clarity("event", "synthetic-heading-flush"));
        if (!skipped) {
            await expect.poll(() => headings(payloads).length, { timeout: 10000 }).toBeGreaterThan(0);
        }
        await page.evaluate(() => window.clarity("stop"));
        await expect.poll(() => payloads.some(payload => payload.e[9] === 1)).toBe(true);
        const values = headings(payloads);
        for (const value of values) {
            assert.ok(value.length <= 191, "Compact heading value exceeds its bound");
            assert.ok(value.split("\n").length <= 3, "More than three headings");
        }
        assert.deepEqual(errors, []);
        const counts = await page.evaluate(() => window.__headingCounts);
        return { layoutMs: layoutCost(payloads), startMs, nodes, values, counts, blocked };
    } catch (error) {
        fs.writeFileSync(path.join(output, `${fixture.name}-${variant.name}-failed.json`),
            JSON.stringify({ diagnostic, payloads, errors, blocked }, null, 2));
        throw new Error(`${fixture.name}/${variant.name}: ${error.message}`, { cause: error });
    } finally {
        await page.close();
    }
}

function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1],
        min: sorted[0], max: sorted[sorted.length - 1] };
}

function escape(value) {
    return String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function reportHtml(report) {
    const rows = report.fixtures.map(fixture => {
        const original = fixture.original.layout.median;
        const encoder = fixture.encoder.layout.median;
        const change = original ? 100 * (encoder - original) / original : null;
        return `<tr><td>${escape(fixture.name)}</td><td>${fixture.nodes}</td>
            <td>${original.toFixed(2)}</td><td>${encoder.toFixed(2)}</td>
            <td>${change === null ? "n/a" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}</td>
            <td>${fixture.original.layout.p95.toFixed(2)} / ${fixture.encoder.layout.p95.toFixed(2)}</td>
            <td>${fixture.original.counts.scrubs} / ${fixture.encoder.counts.scrubs}</td>
            <td>${fixture.encoder.counts.preparedIds}</td></tr>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
        <title>Heading encoder performance comparison</title><style>
        body{font:16px system-ui;margin:36px;max-width:1250px;color:#182337}h1{font-size:30px}
        table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px;border-bottom:1px solid #dbe1e9}
        th{background:#edf2f8}.scroll{overflow:auto}code{background:#edf2f8;padding:2px 5px}
        pre{white-space:pre-wrap;background:#f4f6fa;padding:14px}small{color:#516174}
        </style></head><body><h1>Cached collector vs encoder reuse</h1>
        <p>Original: <code>${report.baselineSha.slice(0, 7)}</code>. Encoder: four implementation iterations plus this benchmark.
        ${report.samples} measured samples per variant/page, two warmups, alternating variant order.</p>
        <div class="scroll"><table><thead><tr><th>Synthetic page</th><th>Elements</th><th>Original median ms</th>
        <th>Encoder median ms</th><th>Change</th><th>p95 original / encoder</th><th>Text scrub calls original / encoder</th>
        <th>Prepared text IDs</th></tr></thead><tbody>${rows}</tbody></table></div>
        <h2>What was measured</h2><p>Timing runs use the real minified SDK and its existing LayoutCost metric,
        summed across uploads. It includes discovery, heading preparation/assembly, encoding and task accounting;
        it is not isolated heading time, request latency or a production Web Vitals measurement. Synchronous start
        duration and all raw samples are in the JSON. Diagnostic scrub counts use separate readable-bundle runs,
        never the timed runs.</p><h2>Correctness and caveats</h2>
        <p>Eligible fixtures must emit identical heading values; lean + lite is intentionally skipped and is not
        a like-for-like speed comparison. Its baseline output depends on which text the lite cache retained.
        Mask length codes cannot preserve original internal whitespace. No real telemetry is uploaded.
        No speed threshold or universal-win claim is imposed. Browser scheduling, JIT, GC and millisecond-rounded
        SDK metrics can dominate small differences. Fragmented headings expose the cost of preparing every
        candidate text ID even though only a short prefix is eventually sent.</p>
        <h2>Bundle sizes</h2><pre>${escape(JSON.stringify(report.bundleSizes, null, 2))}</pre>
        <h2>Encoder controls</h2><pre>${escape(JSON.stringify(report.controls, null, 2))}</pre>
        <small>Generated ${escape(report.timestamp)} using ${escape(report.browser)} on ${escape(report.platform)}.
        Read benchmark.json for full evidence.</small></body></html>`;
}

function load(source, modules, globals = {}) {
    const ts = require(path.join(repo, "packages", "clarity-js", "node_modules", "typescript"));
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017
    } }).outputText;
    const context = { exports: {}, ...globals, require(name) {
        assert.ok(name in modules, `Unexpected dependency ${name}`);
        return modules[name];
    } };
    vm.runInNewContext(compiled, context);
    return context.exports;
}

async function encoderControls() {
    const enums = (name, modules = {}) => load(fs.readFileSync(file(repo, `types\\${name}.d.ts`), "utf8")
        .replace(/export const enum/g, "export enum"), modules);
    const Core = enums("core");
    const Data = enums("data", { "@clarity-types/core": Core });
    const Layout = enums("layout");
    const token = load(fs.readFileSync(file(repo, "src\\data\\token.ts"), "utf8"), { "@clarity-types/data": Data }).default;
    const scrub = load(fs.readFileSync(file(repo, "src\\core\\scrub.ts"), "utf8"), {
        "@clarity-types/core": Core, "@clarity-types/data": Data, "@clarity-types/layout": Layout,
        "@src/core/config": { default: {} }
    });
    const controls = [];
    const modes = Object.entries(Core.Privacy).filter(([, value]) => typeof value === "number");
    for (const [name, privacy] of modes) {
        for (const event of [Data.Event.Discover, Data.Event.Mutation]) {
            const results = [];
            for (const root of [baseline, repo]) {
                const parent = { id: 10, parent: null, children: [11], data: { tag: "H1" },
                    metadata: { active: true, suspend: false, privacy, size: null } };
                const child = { id: 11, parent: 10, children: [], data: { tag: "*T", value: " Public 123 " },
                    metadata: { active: true, suspend: false, privacy, size: null } };
                let rawReads = 0;
                Object.defineProperty(child.data, "value", {
                    get() { rawReads++; return " Public 123 "; }, enumerable: true
                });
                const records = { 10: parent, 11: child };
                const document = {};
                const dom = { get: () => parent, getValue: id => records[id] || null, updates: () => [parent, child] };
                let calls = 0;
                const config = { lean: false, lite: false };
                const producerScrub = { ...scrub, text(...args) { calls++; return scrub.text(...args); } };
                const collector = load(fs.readFileSync(file(root, "src\\layout\\headings.ts"), "utf8"), {
                    "@clarity-types/data": Data, "@clarity-types/layout": Layout,
                    "@src/core/config": { default: config }, "@src/core/scrub": producerScrub,
                    "@src/data/dimension": { log() {} }, "@src/layout/dom": dom
                }, { document });
                collector.start();
                collector.observe({ ownerDocument: document, getRootNode: () => document }, "H1");
                if (root === repo) {
                    collector.prepare();
                    assert.equal(rawReads, 0, "Preparing heading IDs must not read cached raw text");
                }
                const wire = [];
                const encoder = load(fs.readFileSync(file(root, "src\\layout\\encode.ts"), "utf8"), {
                    "@clarity-types/core": Core, "@clarity-types/data": Data, "@clarity-types/layout": Layout,
                    "@src/core/config": { default: config }, "@src/core/scrub": producerScrub,
                    "@src/core/task": { state: () => Core.Task.Run },
                    "@src/core/time": { time: () => 123 }, "@src/data/token": { default: token },
                    "@src/data/baseline": { activity() {} }, "@src/data/upload": { queue: tokens => wire.push(tokens) },
                    "@src/diagnostic/fraud": { check() {} }, "@src/layout/document": {},
                    "@src/layout/dom": dom, "@src/layout/region": {}, "@src/layout/style": {},
                    "@src/layout/animation": {}, "@src/layout/custom": {}, "./headings": collector
                }).default;
                await encoder(event, {}, 123);
                assert.equal(calls, 1, "Encoder must scrub the text exactly once");
                if (root === repo && event === Data.Event.Discover) {
                    const producerReads = rawReads;
                    collector.complete();
                    assert.equal(calls, 1, "Heading completion must not scrub again");
                    assert.equal(rawReads, producerReads, "Heading completion must not read raw text again");
                }
                collector.stop();
                results.push(JSON.stringify(wire));
            }
            assert.equal(results[0], results[1], `${name}: replay wire changed`);
            controls.push(`${name} ${event === Data.Event.Discover ? "Discover" : "Mutation"}: identical wire, one producer scrub`);
        }
    }
    return controls;
}

async function main() {
    const controls = await encoderControls();
    const browser = await chromium.launch();
    const report = { timestamp: new Date().toISOString(), baselineSha, samples, platform: `${os.platform()} ${os.arch()}`,
        browser: browser.version(), controls, bundleSizes: {}, fixtures: [] };
    for (const variant of variants) {
        const bytes = Buffer.from(bundles[variant.name]);
        report.bundleSizes[variant.name] = { minified: bytes.length, gzip: zlib.gzipSync(bytes).length };
    }
    try {
        for (const fixture of fixtures) {
            console.log(`Measuring ${fixture.name}`);
            const measured = { original: [], encoder: [] };
            for (let round = -2; round < samples; round++) {
                const order = round % 2 === 0 ? variants : [...variants].reverse();
                const pair = {};
                for (const variant of order) pair[variant.name] = await runPage(browser, fixture, variant);
                if (fixture.name === "lean-lite") {
                    assert.deepEqual(pair.encoder.values, [], "Lean plus lite must skip headings");
                } else assert.deepEqual(pair.encoder.values, pair.original.values, `${fixture.name}: heading output changed`);
                if (round >= 0) for (const variant of variants) measured[variant.name].push(pair[variant.name]);
            }
            const row = { name: fixture.name, nodes: measured.original[0].nodes };
            for (const variant of variants) {
                const raw = measured[variant.name];
                const diagnostic = await runPage(browser, fixture, variant, true);
                row[variant.name] = { layout: stats(raw.map(run => run.layoutMs)),
                    start: stats(raw.map(run => run.startMs)), counts: diagnostic.counts, values: raw[0].values, raw };
            }
            report.fixtures.push(row);
            fs.writeFileSync(path.join(output, "benchmark.json"), JSON.stringify(report, null, 2));
            console.log(`${row.name}: original ${row.original.layout.median.toFixed(2)} ms; encoder ${row.encoder.layout.median.toFixed(2)} ms`);
        }
        report.pass = true;
        fs.writeFileSync(path.join(output, "benchmark.json"), JSON.stringify(report, null, 2));
        fs.writeFileSync(path.join(output, "report.html"), reportHtml(report));
        console.log(`Report: ${path.join(output, "report.html")}`);
    } finally {
        await browser.close();
    }
}
const run = process.argv.includes("--controls-only") ? async () => {
    const controls = await encoderControls();
    console.log(JSON.stringify({ pass: true, controls }, null, 2));
} : main;
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
