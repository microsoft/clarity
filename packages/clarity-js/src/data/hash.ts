// tslint:disable: no-bitwise
const MAX_HASH_LENGTH = 9;
export default function(input: string): string {
    // Don't hash the input if its less is than or same as max hash length
    if (input && input.length <= MAX_HASH_LENGTH) { return input; }

    // Code inspired from C# GetHashCode: https://github.com/Microsoft/referencesource/blob/master/mscorlib/system/string.cs
    let hash = 0;
    let hashOne = 5381;
    let hashTwo = hashOne;
    for (let i = 0; i < input.length; i += 2) {
        let charOne = input.charCodeAt(i);
        hashOne = ((hashOne << 5) + hashOne) ^ charOne;
        if (i + 1 < input.length) {
            let charTwo = input.charCodeAt(i + 1);
            hashTwo = ((hashTwo << 5) + hashTwo) ^ charTwo;
        }
    }
    // Replace the magic number from C# implementation (1566083941) with a smaller prime number (11579)
    // This ensures we don't hit integer overflow and prevent collisions
    hash = Math.abs(hashOne + (hashTwo * 11579));
    return hash.toString(36).slice(-1 * MAX_HASH_LENGTH); // Limit hashes to MAX_HASH_LENGTH
}
