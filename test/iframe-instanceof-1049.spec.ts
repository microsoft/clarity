import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const CLARITY_MIN = readFileSync(resolve(__dirname, '../packages/clarity-js/build/clarity.min.js'), 'utf8');
const HTML_PATH = resolve(__dirname, './html/iframe-text-1049.html');

// Regression test for https://github.com/microsoft/clarity/issues/1049
// Before the fix, Clarity's parent-realm MutationObserver callback observing an
// iframe document caused Chrome to wrap iframe nodes in the parent realm. That
// broke `node instanceof Text` (and similar identity checks) inside the iframe
// for any text node that came in through a mutation record (outerHTML/innerHTML
// edits, Quill rich-text manipulation, DevTools "Edit as HTML", etc.).
test('issue #1049: iframe text nodes stay instance of iframe Text after mutations', async ({ page }) => {
  await page.goto(pathToFileURL(HTML_PATH).toString());
  await page.waitForFunction(() => {
    const f = document.getElementById('f') as HTMLIFrameElement | null;
    return !!(f && f.contentDocument && f.contentDocument.getElementById('h'));
  });

  await page.addScriptTag({ content: `window.payloads = []; ${CLARITY_MIN}` });
  await page.evaluate(() => (window as any).clarity('start', {
    projectId: 'test',
    delay: 50,
    content: true,
    fraud: [],
    regions: [],
    mask: [],
    unmask: [],
    upload: (payload: string) => { (window as any).payloads.push(payload); }
  }));
  await page.waitForTimeout(500);

  // Edit iframe content (simulates DevTools "Edit as HTML" or Quill outerHTML).
  await page.evaluate(() => (window as any).editAsHtml());
  await page.waitForTimeout(100);

  const fromParent = await page.evaluate(() => (window as any).checks('after-edit'));
  expect(fromParent.instanceofTextIframe, 'text node should still be instance of iframe Text').toBe(true);
  expect(fromParent.ctorIsIframeText, 'constructor should be iframe Text').toBe(true);
  expect(fromParent.protoMatch, 'prototype chain should still point at iframe Text.prototype').toBe(true);

  // Also verify from the iframe's own realm, mirroring how Quill / DevTools
  // console see the node.
  const fromIframe = await page.evaluate(() => {
    const f = document.getElementById('f') as HTMLIFrameElement;
    const idoc = f.contentDocument!;
    const iwin = f.contentWindow as any;
    const script = idoc.createElement('script');
    script.textContent = `
      var h1 = document.getElementById('h');
      var tn = h1 ? h1.firstChild : null;
      window.__iframeCheck = {
        tnVal: tn ? tn.nodeValue : null,
        instanceofText: tn instanceof Text,
        ctorIsText: tn ? tn.constructor === Text : null
      };
    `;
    idoc.body.appendChild(script);
    return iwin.__iframeCheck;
  });
  expect(fromIframe.instanceofText, 'instanceof Text inside iframe should be true').toBe(true);
  expect(fromIframe.ctorIsText, 'constructor === Text inside iframe should be true').toBe(true);
});
