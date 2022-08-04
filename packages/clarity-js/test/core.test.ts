import { assert } from 'chai';
import { Browser, Page } from 'playwright';
import { launch, markup, node, text } from './helper';
import { Data, decode } from "clarity-decode";

let browser: Browser;
let page: Page;

describe('Core Tests', () => {
    before(async () => {
        browser = await launch();
    });

    beforeEach(async () => {
        page = await browser.newPage();
        await page.goto('about:blank');
    });

    afterEach(async () => {
        await page.close();
    });

    after(async () => {
        await browser.close();
        browser = null;
    });

    it('should mask sensitive content by default', async () => {
        let encoded: string[] = await markup(page, "core.html");
        let decoded = encoded.map(x => decode(x));
        let heading = text(decoded, "one");
        let address = text(decoded, "two");
        let email = node(decoded, "attributes.id", "eml");
        let password = node(decoded, "attributes.id", "pwd");
        let search = node(decoded, "attributes.id", "search");
        
        // Non-sensitive fields continue to pass through with sensitive bits masked off
        assert.equal(heading, "Thanks for your order •••••••••");

        // Sensitive fields, including input fields, are randomized and masked
        assert.equal(address, "•••••• ••••• ••••• ••••• ••••• •••••");
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••• ••••");
        assert.equal(search.attributes.value, "hello •••••");
    });

    it('should mask all text in strict mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { content: false });
        let decoded = encoded.map(x => decode(x));
        let heading = text(decoded, "one");
        let address = text(decoded, "two");
        let email = node(decoded, "attributes.id", "eml");
        let password = node(decoded, "attributes.id", "pwd");
        let search = node(decoded, "attributes.id", "search");

        // All fields are randomized and masked
        assert.equal(heading, "• ••••• ••••• ••••• ••••• •••••");
        assert.equal(address, "•••••• ••••• ••••• ••••• ••••• •••••");
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••• ••••");
        assert.equal(search.attributes.value, "••••• •••• ••••");
    });

    it('should unmask all text in relaxed mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { unmask: ["body"] });
        let decoded = encoded.map(x => decode(x));
        let heading = text(decoded, "one");
        let address = text(decoded, "two");
        let email = node(decoded, "attributes.id", "eml");
        let password = node(decoded, "attributes.id", "pwd");
        let search = node(decoded, "attributes.id", "search");

        // Text flows through unmasked for non-sensitive fields, including input fields
        assert.equal(heading, "Thanks for your order #2AB700GH");
        assert.equal(address, "1 Microsoft Way, Redmond, WA - 98052");
        assert.equal(search.attributes.value, "hello w0rld");

        // Sensitive fields are still masked
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••• ••••");
    });

    it('should respect mask config even in relaxed mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { mask: ["#mask"], unmask: ["body"] });
        let decoded = encoded.map(x => decode(x));
        let subtree = text(decoded, "child");
        
        // Masked sub-trees continue to stay masked
        assert.equal(subtree, "••••• •••••");
    });
});
