export default function<T>(input: T): T {
    return JSON.parse(JSON.stringify(input));
}
