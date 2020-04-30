import {Token} from "@clarity-types/data";

export default function(tokens: Token[], metadata: Token[]): Token[] {
    // Following code takes the metadata array and efficiently appends it to the array of tokens that we send over the wire
    // Before it appends, it looks up if any value within the metadata is already present in the tokens array.
    // If so, it finds a reference to it (index) and uses that instead. This helps us save bytes by not repeating the same value twice.
    // E.g. If tokens array is: ["hello", "world", "coding", "language"] and metadata array is: ["world", "language", "example"]
    // Then the resulting tokens array after following code execution would be: ["hello", "world", "coding", "language", [1, 3], "example"]
    // Where [1,3] points to tokens[1] => "hello" and tokens[3] => "coding"
    let reference = null;
    for (let token of metadata) {
        let index = tokens.indexOf(token);
        if (index >= 0) {
            if (reference) { reference.push(index); } else {
                reference = [index];
                tokens.push(reference);
            }
        } else {
            reference = null;
            tokens.push(token);
        }
    }
    return tokens;
}
