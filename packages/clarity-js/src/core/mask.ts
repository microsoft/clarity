export default function(value: string, compress: boolean = false): string {
    // If compression is enabled, compute and send back only the length of the text content
    // We still preserve all leading and trailing space characters to ensure markup remains consistent
    if (compress && value) {
        let trimmed = value.trim();
        if (trimmed.length > 0) {
            let first = trimmed[0];
            let index = value.indexOf(first);
            let prefix = value.substr(0, index);
            let suffix = value.substr(index + trimmed.length);
            return `${prefix}${trimmed.length.toString(36)}${suffix}`;
        } else { return value; }
    }
    return value ? value.replace(/\S/gi, "*") : value;
}
