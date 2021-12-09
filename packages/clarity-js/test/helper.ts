import { Core, Data, Layout } from "clarity-decode";
import * as fs from 'fs';
import * as url from 'url';
import * as path from 'path';
import { Browser, Page, chromium } from 'playwright';

export async function launch(): Promise<Browser> {
    return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

export async function markup(page: Page, file: string, override: Core.Config = null): Promise<string[]> {
    const htmlPath = path.resolve(__dirname, `./html/${file}`);
    const htmlFileUrl = url.pathToFileURL(htmlPath).toString();
    const html = fs.readFileSync(htmlPath, 'utf8');
    await Promise.all([
        page.goto(htmlFileUrl),
        page.waitForNavigation()
    ]);
    await page.setContent(html.replace("</body>", `
        <script>
          window.payloads = [];
          ${fs.readFileSync(path.resolve(__dirname, `../build/clarity.min.js`), 'utf8')};
          clarity("start", ${config(override)});
        </script>
        </body>
    `));
    await page.hover("#two");
    await page.waitForFunction("payloads && payloads.length > 1");
    return await page.evaluate('payloads');
}

export function node(decoded: Data.DecodedPayload[], key: string, value: string | number, tag: string = null): Layout.DomData {
    let sub = null;

    // Exploding nested keys into key and sub key
    if (key.indexOf(".") > 0) {
        const parts = key.split(".");
        if (parts.length === 2) {
            key = parts[0];
            sub = parts[1];
        }
    }

    // Walking over the decoded payload to find the right match
    for (let i = decoded.length - 1; i >= 0; i--) {
        if (decoded[i].dom) {
            for (let j = 0; j < decoded[i].dom.length; j++) {
                if (decoded[i].dom[j].data) {
                    for (let k = 0; k < decoded[i].dom[j].data.length; k++) {
                        let d = decoded[i].dom[j].data[k];
                        if ((sub && d[key] && d[key][sub] === value) ||
                            (d[key] && d[key] === value)) {
                                if ((tag && d.tag === tag) || tag === null) {
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

export function text(decoded: Data.DecodedPayload[], id: string): string {
    let parent = node(decoded, "attributes.id", id);
    if (parent) {
        let child = node(decoded, "parent", parent.id, "*T");
        if (child && child.value) {
            return child.value;
        }
    }
    return null;
}


function config(override: Core.Config): string {
    const settings = {
        delay: 100,
        content: true,
        upload: payload => { window["payloads"].push(payload); window["clarity"]("upgrade", "test"); }
    }

    // Process overrides
    if (override){
        for (let key of Object.keys(override)) {
            settings[key] = override[key];
        }
    }

    // Serialize configuration
    let output = "";
    for (let key of Object.keys(settings)) {
        switch (key) {
            case "upload":
                output += `${JSON.stringify(key)}: ${settings[key].toString()},`;
                break;
            case "projectId":
            case "mask":
            case "unmask":
            case "regions":
            case "cookies":
                output += `${JSON.stringify(key)}: ${JSON.stringify(settings[key])},`;
                break;
            default:
                output += `${JSON.stringify(key)}: ${settings[key]},`;
                break;
        }
    }
    output += `"projectId": "test"`;
    return "{" + output + "}";
}
