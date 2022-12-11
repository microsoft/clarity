import { assert } from 'chai';
import { Browser, Page } from 'playwright';
import { changes, clicks, inputs, launch, markup, node, text } from './helper';
import { decode } from "clarity-decode";

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
        let card = node(decoded, "attributes.id", "cardnum");
        let textarea = text(decoded, "textarea");
        let click = clicks(decoded)[0];
        let input = inputs(decoded)[0];
        let group = changes(decoded);
        
        // Non-sensitive fields continue to pass through with sensitive bits masked off
        assert.equal(heading, "Thanks for your order #▫▪▪▫▫▫▪▪");

        // Sensitive fields, including input fields, are randomized and masked
        assert.equal(address, "•••••• ••••• ••••• ••••• ••••• •••••");
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••");
        assert.equal(search.attributes.value, "••••• •••• ••••");
        assert.equal(card.attributes.value, "•••••");
        assert.equal(textarea, "••••• •••••");

        // Clicked text and input value should be consistent with uber masking configuration
        assert.equal(click.data.text, "Hello ▪▪▪▫▪");
        assert.equal(input.data.value, "••••• •••• •••• ••••");
        assert.equal(group.length, 2);
        // Search change - we should captured mangled input and hash
        assert.equal(group[0].data.type, "search");
        assert.equal(group[0].data.value, "••••• •••• •••• ••••");
        assert.equal(group[0].data.checksum, "4y7m6");
        // Password change - we should capture placholder value and empty hash
        assert.equal(group[1].data.type, "password");
        assert.equal(group[1].data.value, "••••");
        assert.equal(group[1].data.checksum, "");
    });

    it('should mask all text in strict mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { content: false });
        let decoded = encoded.map(x => decode(x));
        let heading = text(decoded, "one");
        let address = text(decoded, "two");
        let email = node(decoded, "attributes.id", "eml");
        let password = node(decoded, "attributes.id", "pwd");
        let search = node(decoded, "attributes.id", "search");
        let card = node(decoded, "attributes.id", "cardnum");
        let click = clicks(decoded)[0];
        let input = inputs(decoded)[0];

        // All fields are randomized and masked
        assert.equal(heading, "• ••••• ••••• ••••• ••••• •••••");
        assert.equal(address, "•••••• ••••• ••••• ••••• ••••• •••••");
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••");
        assert.equal(search.attributes.value, "••••• •••• ••••");
        assert.equal(card.attributes.value, "•••••");

        // Clicked text and input value should also be masked in strict mode
        assert.equal(click.data.text, "••••• •••• ••••");
        assert.equal(input.data.value, "••••• •••• •••• ••••");
    });

    it('should unmask non-sensitive text in relaxed mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { unmask: ["body"] });
        let decoded = encoded.map(x => decode(x));
        let heading = text(decoded, "one");
        let address = text(decoded, "two");
        let email = node(decoded, "attributes.id", "eml");
        let password = node(decoded, "attributes.id", "pwd");
        let search = node(decoded, "attributes.id", "search");
        let card = node(decoded, "attributes.id", "cardnum");
        let click = clicks(decoded)[0];
        let input = inputs(decoded)[0];

        // Text flows through unmasked for non-sensitive fields, with exception of input fields
        assert.equal(heading, "Thanks for your order #2AB700GH");
        assert.equal(address, "1 Microsoft Way, Redmond, WA - 98052");
        assert.equal(search.attributes.value, "••••• •••• ••••");

        // Sensitive fields are still masked
        assert.equal(email.attributes.value, "••••• •••• •••• ••••");
        assert.equal(password.attributes.value, "••••");
        assert.equal(card.attributes.value, "•••••");

        // Clicked text comes through unmasked in relaxed mode but input is still masked
        assert.equal(click.data.text, "Hello Wor1d");
        assert.equal(input.data.value, "••••• •••• •••• ••••");
    });

    it('should respect mask config even in relaxed mode', async () => {
        let encoded: string[] = await markup(page, "core.html", { mask: ["#mask"], unmask: ["body"] });
        let decoded = encoded.map(x => decode(x));
        let subtree = text(decoded, "child");
        let click = clicks(decoded)[0];
        let input = inputs(decoded)[0];
        
        // Masked sub-trees continue to stay masked
        assert.equal(subtree, "••••• •••••");

        // Clicked text is masked due to masked configuration and input value is also masked
        assert.equal(click.data.text, "••••• •••• ••••");
        assert.equal(input.data.value, "••••• •••• •••• ••••");
    });
});
