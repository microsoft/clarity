const whitespace = /\s+/g;

export function normalizeText(value: string): string {
    return value.replace(whitespace, " ").trim();
}
