import { test, expect } from '@playwright/test';
import { decode } from 'clarity-decode';

test.describe('decode function', () => {
    test('should decode a simple payload', () => {
        // This is a very simple test that focuses on basic decoding functionality
        const testPayload = {
          e: ["0.8.20", 1, 0, 506, "devtools", "1mtqiaz", "1c27tix", 2, 0, 0, 0, "https://test.com/"],
          a: [
            [2, 8, 1982, 3098],
            [29, 11, 1982, 992],
            [29, 28, 1],
            [35, 29, 63, 65, 421, 421, 551, 552, 941, 1820, 1821, 1826, 0, 23734, "navigate", "h2", 23434, 138226],
            [36, 7, 116, 16, 13, "1"],
            [36, 7, 120, 16, 0, "2"],
            [36, 7, 203, 16, 13, "3"],
            [505, 1, 0, ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"], 1, ["https://test.com/"], 3, ["A little bit of this and that!"], 4, ["test.com"], 5, ["BlogPosting"], 9, ["en-US"], 15, ["1xtxvl0"], 17, ["ltr"], 18, ["Story 8", "Story 7", "Story 6"], 20, ["A title!"], 21, ["blogger"], 22, ["macOS"], 23, ["15.5.0"], 24, ["undefined~8", "undefined~138"], 26, ["1.7999999523162842"], 27, ["4g"], 28, ["1979"], 29, ["2"], 31, ["44nejbc7s.6933hhug7"], 32, ["519i394pb.53uwavtzg"], 34, ["America/Los_Angeles"], 35, ["420"], 36, ["1"], 37, ["-1"]],
            [505, 0, 0, 1752816151601, 1, 1, 3, 34, 4, 35, 5, 3, 7, 4, 8, 1636, 9, 0, 10, 2, 14, 1792, 15, 1120, 16, 24, 25, 9, 26, 0, 27, 0, 31, 1, 32, 0, 33, 8, 34, 8, 35, 0],
            [506, 47, 0, 1, 1],
            [550, 48, 488, 493, 484, 16383, 16383, 2, 1, 0, "It's a title", null, "1ltv07afj", "4ppc0yuhe", 1, 0]
          ],
        };

        const input = JSON.stringify(testPayload);

        const result = decode(input);
        
        expect(typeof result).toBe('object');
        expect(typeof result.timestamp).toBe('number');
        expect(typeof result.envelope).toBe('object');
        expect(result.envelope.version).toBe("0.8.20");
        expect(result.visibility[0].data.visible).toBe(1);
        expect(result.contextMenu[0].data.target).toBe(488);
        expect(result.contextMenu[0].data.button).toBe(2);
    });

    test('visibility event should be backward compatible to support string values', () => {
        // This is a very simple test that focuses on basic decoding functionality
        const testPayload = {
          e: ["0.8.20", 1, 0, 506, "devtools", "1mtqiaz", "1c27tix", 2, 0, 0, 0, "https://test.com/"],
          a: [
            [2, 8, 1982, 3098],
            [29, 11, 1982, 992],
            [29, 28, "visible"],
            [505, 1, 0, ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"], 1, ["https://test.com/"], 3, ["A little bit of this and that!"], 4, ["test.com"], 5, ["BlogPosting"], 9, ["en-US"], 15, ["1xtxvl0"], 17, ["ltr"], 18, ["Story 8", "Story 7", "Story 6"], 20, ["A title!"], 21, ["blogger"], 22, ["macOS"], 23, ["15.5.0"], 24, ["undefined~8", "undefined~138"], 26, ["1.7999999523162842"], 27, ["4g"], 28, ["1979"], 29, ["2"], 31, ["44nejbc7s.6933hhug7"], 32, ["519i394pb.53uwavtzg"], 34, ["America/Los_Angeles"], 35, ["420"], 36, ["1"], 37, ["-1"]],
            [505, 0, 0, 1752816151601, 1, 1, 3, 34, 4, 35, 5, 3, 7, 4, 8, 1636, 9, 0, 10, 2, 14, 1792, 15, 1120, 16, 24, 25, 9, 26, 0, 27, 0, 31, 1, 32, 0, 33, 8, 34, 8, 35, 0],
            [506, 47, 0, 1, 1],
            [550, 48, 488, 493, 484, 16383, 16383, 2, 1, 0, "It's a title", null, "1ltv07afj", "4ppc0yuhe", 1, 0]
          ],
        };

        const input = JSON.stringify(testPayload);

        const result = decode(input);
        
        expect(typeof result).toBe('object');
        expect(typeof result.timestamp).toBe('number');
        expect(typeof result.envelope).toBe('object');
        expect(result.envelope.version).toBe("0.8.20");
        expect(result.visibility[0].data.visible).toBe(1);
    });
});