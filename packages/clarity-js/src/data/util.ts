export function supported(target: Window | Document, api: string): boolean {
  try { return !!target[api]; } catch { return false; }
}

export function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

export function decodeCookieValue(value: string): [boolean, string] {
  try {
    let decodedValue = decodeURIComponent(value);
    return [decodedValue != value, decodedValue];
  }
  catch {
  }

  return [false, value];
}