export default function(value: string): string {
    return value.replace(/\S/gi, "*");
}
