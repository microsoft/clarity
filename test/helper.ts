import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import type { Page } from '@playwright/test';
import type { Core, Data, Layout } from "clarity-decode";

declare global {
    interface Window {
        clarity: (method: string, ...args: any[]) => void,
        payloads: string[];
    }
}

export async function markup(page: Page, file: string, override?: Core.Config): Promise<string[]> {
    const htmlPath = resolve(__dirname, `./html/${file}`);
    const htmlFileUrl = pathToFileURL(htmlPath).toString();
    const html = readFileSync(htmlPath, 'utf8');
    await page.goto(htmlFileUrl);
    await page.setContent(html.replace("</body>", `
        <script>
          window.payloads = [];
          ${readFileSync(resolve(__dirname, `../packages/clarity-js/build/clarity.min.js`), 'utf8')};
          clarity("start", ${config(override)});
        </script>
        </body>
    `));
    await page.hover("#two");
    await page.click("#child");
    await page.locator('#search').fill('');
    await page.locator('#search').type('query with numb3rs');
    await page.locator('#pwd').type('p1ssw0rd');
    await page.locator('#eml').fill('');
    await page.locator('#eml').type('hello@world.com');
    await page.waitForFunction("payloads && payloads.length > 2");
    return await page.evaluate('payloads');
}

type PayloadEvent<K extends keyof Data.DecodedPayload> =
    Data.DecodedPayload[K] extends (infer U)[] | undefined ? U : never;
function extractEvents<K extends keyof Data.DecodedPayload>(
    decoded: Data.DecodedPayload[],
    eventType: K
): PayloadEvent<K>[] {
    const output: PayloadEvent<K>[] = [];
    for (let i = decoded.length - 1; i >= 0; i--) {
        const events = decoded[i][eventType];
        if (events && Array.isArray(events)) {
            output.push(...events);
        }
    }
    return output;
}

export const clicks = (decoded: Data.DecodedPayload[]) => extractEvents(decoded, 'click');

export const inputs = (decoded: Data.DecodedPayload[]) => extractEvents(decoded, 'input');

export const changes = (decoded: Data.DecodedPayload[]) => extractEvents(decoded, 'change');

export function node(decoded: Data.DecodedPayload[], key: keyof Layout.DomData, value: string | number, sub?: string, tag?: string): Layout.DomData | null {
    // Walking over the decoded payload to find the right match
    for (let i = decoded.length - 1; i >= 0; i--) {
        const dom = decoded[i].dom;
        if (dom) {
            for (const event of dom) {
                if (event.data) {
                    for (const d of event.data) {
                        const v = key === 'attributes' ? d.attributes?.[sub!] : d[key];
                        if (v === value) {
                            if ((tag && d.tag === tag) || tag === undefined) {
                                return d;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}

export function text(decoded: Data.DecodedPayload[], id: string): string | null {
    const parent = node(decoded, "attributes", id, "id");
    if (parent) {
        const child = node(decoded, "parent", parent.id, undefined, "*T");
        if (child && child.value) {
            return child.value;
        }
    }
    return null;
}


function config(override?: Core.Config): string {
    const settings = {
        delay: 100,
        content: true,
        fraud: [],
        regions: [],
        mask: [],
        unmask: [],
        upload: (payload: string) => { window.payloads.push(payload); window.clarity("upgrade", "test"); },
        ...override,
    };

    // Serialize configuration
    let output = "";
    for (const [key, value] of Object.entries(settings)) {
        switch (key) {
            case "upload":
                output += `${JSON.stringify(key)}: ${value.toString()},`;
                break;
            case "projectId":
            case "mask":
            case "unmask":
            case "regions":
            case "cookies":
            case "fraud":
                output += `${JSON.stringify(key)}: ${JSON.stringify(value)},`;
                break;
            default:
                output += `${JSON.stringify(key)}: ${value},`;
                break;
        }
    }
    output += `"projectId": "test"`;
    return "{" + output + "}";
}
