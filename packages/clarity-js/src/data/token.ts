import {Constant, Token} from "@clarity-types/data";

// Following code takes an array of tokens and transforms it to optimize for repeating tokens and make it efficient to send over the wire
// The way it works is that it iterate over all tokens and checks if the current token was already seen in the tokens array so far
// If so, it replaces the token with its reference (index). This helps us save bytes by not repeating the same value twice.
// E.g. If tokens array is: ["hello", "world", "coding", "language", "world", "language", "example"]
// Then the resulting tokens array after following code execution would be: ["hello", "world", "coding", "language", [1, 3], "example"]
// Where [1,3] points to tokens[1] => "world" and tokens[3] => "language"
export default function(tokens: Token[]): Token[] {
    let output: Token[] = [];
    let lookup: {[key: string]: number} = {};
    let pointer = 0;
    let reference = null;
    for (let i = 0; i < tokens.length; i++) {
        // Only optimize for string values
        if (typeof tokens[i] === Constant.String) {
            let token = tokens[i] as string;
            let index = lookup[token] || -1;
            if (index >= 0) {
                if (reference) { reference.push(index); } else {
                    reference = [index];
                    output.push(reference);
                    pointer++;
                }
            } else {
                reference = null;
                output.push(token);
                lookup[token] = pointer++;
            }
        } else {
            // If the value is anything other than string, append it as it is to the output array
            // And, also increment the pointer to stay in sync with output array
            reference = null;
            output.push(tokens[i]);
            pointer++;
        }
    }
    return output;
}
