import * as queue from "@src/queue";

// Process anything that was queued up before the script loaded
(function(): void {
    queue.process();
})();
