# Clarity Session Replay — SRI-Induced Unstyled Rendering

## Problem Statement

Microsoft Clarity session replays render **unstyled** for sites that ship Subresource Integrity (SRI) hashes on their assets (e.g., Vite-built apps such as `r1rcm.com`).

When a user views a recorded session in the Clarity replay player, the page appears as raw HTML — no layout, no theming, broken images, no fonts.

### Browser console error

```
Failed to find a valid digest in the 'integrity' attribute for resource
'https://tm-cachedresources.trafficmanager.net/cached-resources/api/resources/.../app-CHCcx9Vv.css'
with computed SHA-384 integrity 'Q7OHP5KIrtLH9y+lze/PF7HKCOQCOqXo9OLmM+nvVRf4+Po7To5t5jLVsPqIaP5T'.
The resource has been blocked.
```

### Root cause

1. The live site emits `<link rel="stylesheet" integrity="sha384-..." crossorigin>` and similar SRI-protected `<link rel="modulepreload">`, `<link rel="preload">`, and `<script integrity>` tags.
2. Clarity's DOM-capture step records these attributes verbatim into the session payload.
3. At replay time, Clarity's DOM reconstructor (`clarity-visualize`) re-creates the `<link>` / `<script>` nodes inside the playback iframe, **including the original `integrity=` value**.
4. The asset URL is rewritten to point at Clarity's cached-resources proxy (`tm-cachedresources.trafficmanager.net`).
5. The proxy returns a copy of the asset whose bytes differ from the original (re-compression, re-encoding, or simply a redeployed file).
6. The browser computes SHA-384 over the proxied bytes, compares it to the recorded `integrity` value, the hashes don't match → **browser blocks the resource**.
7. CSS / JS / fonts never load → replay renders unstyled.

### Why the existing fix didn't cover this

[PR #365](https://github.com/microsoft/clarity/pull/365) (merged March 2023) added integrity stripping — but **only on the proxied stylesheet path**. The captured rec_html shows the failure mode: every site emits *both* a `<link rel="preload" as="style" integrity>` *and* a `<link rel="stylesheet" integrity>` for the same CSS file. The preload fires first, the browser caches the SRI failure on the URL, and the later stylesheet load fails too — even though stylesheet integrity stripping had been added.

[Issue #418](https://github.com/microsoft/clarity/issues/418) tracks the unresolved gap.

### Code locations checked

| File | Behavior before fix |
|---|---|
| `packages/clarity-visualize/src/layout.ts` — `case "LINK"` (stylesheet branch) | Stripped integrity ✅ |
| `packages/clarity-visualize/src/layout.ts` — `case "LINK"` (preload / modulepreload / preconnect branch) | **Did not strip integrity** ❌ |
| `packages/clarity-visualize/src/layout.ts` — `case "SCRIPT"` / `insertDefaultElement` | **Did not strip integrity** ❌ |

## Proposed Solution

Strip the `integrity` attribute from **every reconstructed DOM node** during replay, not just from proxied stylesheets.

SRI's purpose is tamper detection on the live site. Inside a sandboxed playback iframe, the protection is meaningless — the assets are already proxied through a Microsoft-controlled domain, and the recorded hash is computed against bytes that no longer exist on the wire. Stripping is safe and removes the entire failure class.

### Implementation

Add a static helper on `LayoutHelper` and call it from both code paths that produce SRI-eligible elements.

```typescript
// packages/clarity-visualize/src/layout.ts

/** Remove the SRI `integrity` attribute. See microsoft/clarity#418. */
public static stripIntegrity(element: HTMLElement): void {
    if (!element) { return; }
    if (typeof element.hasAttribute === "function" && element.hasAttribute("integrity")) {
        element.removeAttribute("integrity");
    }
}
```

Call sites:

| Location | Covers |
|---|---|
| `case "LINK"` after `setAttributes` | `<link rel="stylesheet">`, `<link rel="preload">`, `<link rel="modulepreload">`, `<link rel="preconnect">` |
| `insertDefaultElement` after `setAttributes` | `<script>` and any other default-path tag |

Also extend the preload-rel matcher to include `modulepreload` and `as="script"`, since Vite-built sites emit those for JS chunks.

### Trade-offs

- **Pro:** One-time, contained, ~18-line change in `clarity-visualize`. No server-side changes needed. Fixes all current and future Vite/webpack-SRI sites without per-customer intervention.
- **Pro:** Idempotent and null-safe — no-op when integrity isn't present, doesn't throw on null.
- **Con:** None for replay correctness. SRI on the *live* site continues to function normally — only the playback DOM is altered.

## Workarounds Customers Can Use Today

Until the fix ships in `clarity-visualize`:

| Workaround | Effort | Effect |
|---|---|---|
| Strip `integrity=` and `crossorigin=` from a saved DOM-snapshot HTML and open locally | 30 seconds | Static view of one captured session |
| Launch Edge with `--disable-web-security --user-data-dir="C:\temp\edge-nosec"` | 1 minute | Live Clarity replay UI works for that throwaway profile |
| Disable `vite-plugin-sri` in the customer's build pipeline | 1 PR | Future recordings record without integrity, replay correctly forever; loses CDN tamper-protection on live site |

## Status

| Item | State |
|---|---|
| Issue tracked | [microsoft/clarity#418](https://github.com/microsoft/clarity/issues/418) (open) |
| Earlier partial fix | [microsoft/clarity#365](https://github.com/microsoft/clarity/pull/365) (merged, incomplete) |
| Branch with the fix | `jsj/fix-sri-integrity-stripping-replay` (commit `fc0345d`) |
| Pushed to remote | Yes — `microsoft/clarity` |
| Test results | Full suite 44/44 (1 unrelated pre-existing flake in `consentv2.test.ts`) |
| Pull request | Pending |
