import { test, expect } from '@playwright/test';
import { changes, clicks, inputs, markup, node, text } from './helper';
import { decode } from 'clarity-decode';

test.describe('Masking Tests', () => {
    test('should mask sensitive content by default', async ({ page }) => {
        const encoded: string[] = await markup(page, "core.html");
        const decoded = encoded.map(x => decode(x));
        const heading = text(decoded, "one");
        const address = text(decoded, "two");
        const email = node(decoded, "attributes", "eml", "id");
        const password = node(decoded, "attributes", "pwd", "id");
        const search = node(decoded, "attributes", "search", "id");
        const card = node(decoded, "attributes", "cardnum", "id");
        const option = text(decoded, "option1");
        const textarea = text(decoded, "textarea");
        const click = clicks(decoded)[0];
        const input = inputs(decoded)[0];
        const group = changes(decoded);
        
        // Non-sensitive fields continue to pass through with sensitive bits masked off
        expect(heading).toBe("Thanks for your order #▫▪▪▫▫▫▪▪");

        // Sensitive fields, including input fields, are randomized and masked
        expect(address).toBe("•••••• ••••• ••••• ••••• ••••• •••••");
        expect(email?.attributes?.value).toBe("••••• •••• •••• ••••");
        expect(password?.attributes?.value).toBe("••••");
        expect(search?.attributes?.value).toBe("••••• •••• ••••");
        expect(card?.attributes?.value).toBe("•••••");
        expect(textarea).toBe("••••• •••••");
        expect(option).toBe("• •••••");

        // Clicked text and input value should be consistent with uber masking configuration
        expect(click.data.text).toBe("Hello ▪▪▪▫▪");
        expect(input.data.value).toBe("••••• •••• •••• ••••");
        expect(group.length).toBe(2);
        // Search change - we should captured mangled input and hash
        expect(group[0].data.type).toBe("search");
        expect(group[0].data.value).toBe("••••• •••• •••• ••••");
        expect(group[0].data.checksum).toBe("oxedq");
        // Password change - we should capture placeholder value and empty hash
        expect(group[1].data.type).toBe("password");
        expect(group[1].data.value).toBe("••••");
        expect(group[1].data.checksum).toBe("");
    });

    test('should mask all text in strict mode', async ({ page }) => {
        const encoded: string[] = await markup(page, "core.html", { content: false });
        const decoded = encoded.map(x => decode(x));
        const heading = text(decoded, "one");
        const address = text(decoded, "two");
        const email = node(decoded, "attributes", "eml", "id");
        const password = node(decoded, "attributes", "pwd", "id");
        const search = node(decoded, "attributes", "search", "id");
        const card = node(decoded, "attributes", "cardnum", "id");
        const click = clicks(decoded)[0];
        const input = inputs(decoded)[0];
        const option = text(decoded, "option1");

        // All fields are randomized and masked
        expect(heading).toBe("• ••••• ••••• ••••• ••••• •••••");
        expect(address).toBe("•••••• ••••• ••••• ••••• ••••• •••••");
        expect(email?.attributes?.value).toBe("••••• •••• •••• ••••");
        expect(password?.attributes?.value).toBe("••••");
        expect(search?.attributes?.value).toBe("••••• •••• ••••");
        expect(card?.attributes?.value).toBe("•••••");
        expect(option).toBe("• •••••");

        // Clicked text and input value should also be masked in strict mode
        expect(click.data.text).toBe("••••• •••• ••••");
        expect(input.data.value).toBe("••••• •••• •••• ••••");
    });

    test('should unmask non-sensitive text in relaxed mode', async ({ page }) => {
        const encoded: string[] = await markup(page, "core.html", { unmask: ["body"] });
        const decoded = encoded.map(x => decode(x));
        const heading = text(decoded, "one");
        const address = text(decoded, "two");
        const email = node(decoded, "attributes", "eml", "id");
        const password = node(decoded, "attributes", "pwd", "id");
        const search = node(decoded, "attributes", "search", "id");
        const card = node(decoded, "attributes", "cardnum", "id");
        const click = clicks(decoded)[0];
        const input = inputs(decoded)[0];
        const option = text(decoded, "option1");

        // Text flows through unmasked for non-sensitive fields, with exception of input fields
        expect(heading).toBe("Thanks for your order #2AB700GH");
        expect(address).toBe("1 Microsoft Way, Redmond, WA - 98052");
        expect(search?.attributes?.value).toBe("••••• •••• ••••");
        expect(option).toBe("• •••••");

        // Sensitive fields are still masked
        expect(email?.attributes?.value).toBe("••••• •••• •••• ••••");
        expect(password?.attributes?.value).toBe("••••");
        expect(card?.attributes?.value).toBe("•••••");

        // Clicked text comes through unmasked in relaxed mode but input is still masked
        expect(click.data.text).toBe("Hello Wor1d");
        expect(input.data.value).toBe("••••• •••• •••• ••••");
    });

    test('should respect mask config even in relaxed mode', async ({ page }) => {
        const encoded: string[] = await markup(page, "core.html", { mask: ["#mask"], unmask: ["body"] });
        const decoded = encoded.map(x => decode(x));
        const subtree = text(decoded, "child");
        const click = clicks(decoded)[0];
        const input = inputs(decoded)[0];
        
        // Masked sub-trees continue to stay masked
        expect(subtree).toBe("••••• •••••");

        // Clicked text is masked due to masked configuration and input value is also masked
        expect(click.data.text).toBe("••••• •••• ••••");
        expect(input.data.value).toBe("••••• •••• •••• ••••");
    });
});
