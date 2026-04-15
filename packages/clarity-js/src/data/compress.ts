import { Constant } from "@clarity-types/data";

const supported = Constant.CompressionStream in window;

export default async function(input: string): Promise<Uint8Array> {
    try {
        if (supported) {
            // Create a readable stream from given input string and
            // pipe it through text encoder and compression stream to gzip it
            const stream = new ReadableStream({async start(controller) {
                controller.enqueue(input);
                controller.close();
            }}).pipeThrough(new TextEncoderStream()).pipeThrough(new window[Constant.CompressionStream]("gzip"));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        }
    } catch { /* do nothing */ }
    return null;
}
