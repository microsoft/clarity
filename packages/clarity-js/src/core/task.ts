import { AsyncTask, Priority, RequestIdleCallbackDeadline, RequestIdleCallbackOptions, Task, Timer } from "@clarity-types/core";
import { Setting, TaskFunction, TaskResolve, Tasks } from "@clarity-types/core";
import { Code, Metric, Severity } from "@clarity-types/data";
import * as metadata from "@src/data/metadata";
import * as metric from "@src/data/metric";
import * as internal from "@src/diagnostic/internal";

// Track the start time to be able to compute duration at the end of the task
const idleTimeout = 5000;
let tracker: Tasks = {};
let queuedTasks: AsyncTask[] = [];
let activeTask: AsyncTask = null;
let pauseTask: Promise<void> = null;
let resumeResolve: TaskResolve = null;

export function pause(): void {
    if (pauseTask === null) {
        pauseTask = new Promise<void>((resolve: TaskResolve): void => {
            resumeResolve = resolve;
        });
    }
}

export function resume(): void {
    if (pauseTask) {
        resumeResolve();
        pauseTask = null;
        if (activeTask === null) { run(); }
    }
}

export function reset(): void {
    tracker = {};
    queuedTasks = [];
    activeTask = null;
    pauseTask = null;
}

export async function schedule(task: TaskFunction, priority: Priority = Priority.Normal): Promise<void> {
    // If this task is already scheduled, skip it
    for (let q of queuedTasks) {
        if (q.task === task) {
            return;
        }
    }

    let promise = new Promise<void>((resolve: TaskResolve): void => {
        let insert = priority === Priority.High ? "unshift" : "push";
        // Queue this task for asynchronous execution later
        // We also store a unique page identifier (id) along with the task to ensure
        // ensure that we do not accidentally execute this task in context of a different page
        queuedTasks[insert]({ task, resolve, id: metadata.id() });
    });

    // If there is no active task running, and Clarity is not in pause state,
    // invoke the first task in the queue synchronously. This ensures that we don't yield the thread during unload event
    if (activeTask === null && pauseTask === null) { run(); }

    return promise;
}

function run(): void {
    let entry = queuedTasks.shift();
    if (entry) {
        activeTask = entry;
        entry.task().then((): void => {
            // Bail out if the context in which this task was operating is different from the current page
            // An example scenario where task could span across pages is Single Page Applications (SPA)
            // A task that started on page #1, but completes on page #2
            if (entry.id !== metadata.id()) { return; }
            entry.resolve();
            activeTask = null; // Reset active task back to null now that the promise is resolved
            run();
        }).catch((error: Error): void => {
            // If one of the scheduled tasks failed, log, recover and continue processing rest of the tasks
            if (entry.id !== metadata.id()) { return; }
            if (error) { internal.log(Code.RunTask, Severity.Warning, error.name, error.message, error.stack); }
            activeTask = null;
            run();
        });
    }
}

export function state(timer: Timer): Task {
    let id = key(timer);
    if (id in tracker) {
        let elapsed = performance.now() - tracker[id].start;
        return (elapsed > tracker[id].yield) ? Task.Wait : Task.Run;
    }
    // If this task is no longer being tracked, send stop message to the caller
    return Task.Stop;
}

export function start(timer: Timer): void {
    tracker[key(timer)] = { start: performance.now(), calls: 0, yield: Setting.LongTask };
}

function restart(timer: Timer): void {
    let id = key(timer);
    if (tracker && tracker[id]) {
        let c = tracker[id].calls;
        let y = tracker[id].yield;
        start(timer);
        tracker[id].calls = c + 1;
        tracker[id].yield = y;
    }
}

export function stop(timer: Timer): void {
    let end = performance.now();
    let id = key(timer);
    let duration = end - tracker[id].start;
    metric.sum(timer.cost, duration);
    metric.count(Metric.InvokeCount);

    // For the first execution, which is synchronous, time is automatically counted towards TotalDuration.
    // However, for subsequent asynchronous runs, we need to manually update TotalDuration metric.
    if (tracker[id].calls > 0) { metric.sum(Metric.TotalCost, duration); }
}

export async function suspend(timer: Timer): Promise<Task> {
    // Suspend and yield the thread only if the task is still being tracked
    // It's possible that Clarity is wrapping up instrumentation on a page and we are still in the middle of an async task.
    // In that case, we do not wish to continue yielding thread.
    // Instead, we will turn async task into a sync task and maximize our chances of getting some data back.
    let id = key(timer);
    if (id in tracker) {
        stop(timer);
        tracker[id].yield = (await wait()).timeRemaining();
        restart(timer);
    }
    // After we are done with suspending task, ensure that we are still operating in the right context
    // If the task is still being tracked, continue running the task, otherwise ask caller to stop execution
    return id in tracker ? Task.Run : Task.Stop;
}

function key(timer: Timer): string {
    return `${timer.id}.${timer.cost}`;
}

async function wait(): Promise<RequestIdleCallbackDeadline> {
    if (pauseTask) { await pauseTask; }
    return new Promise<RequestIdleCallbackDeadline>((resolve: (deadline: RequestIdleCallbackDeadline) => void): void => {
        requestIdleCallback(resolve, { timeout: idleTimeout });
    });
}

// Use native implementation of requestIdleCallback if it exists.
// Otherwise, fall back to a custom implementation using requestAnimationFrame & MessageChannel.
// While it's not possible to build a perfect polyfill given the nature of this API, the following code attempts to get close.
// Background context: requestAnimationFrame invokes the js code right before: style, layout and paint computation within the frame.
// This means, that any code that runs as part of requestAnimationFrame will by default be blocking in nature. Not what we want.
// For non-blocking behavior, We need to know when browser has finished painiting. This can be accomplished in two different ways (hacks):
//   (1) Use MessageChannel to pass the message, and browser will receive the message right after pain event has occured.
//   (2) Use setTimeout call within requestAnimationFrame. This also works, but there's a risk that browser may throttle setTimeout calls.
// Given this information, we are currently using (1) from above. More information on (2) as well as some additional context is below:
// https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Performance_best_practices_for_Firefox_fe_engineers
function requestIdleCallbackPolyfill(callback: (deadline: RequestIdleCallbackDeadline) => void, options: RequestIdleCallbackOptions): void {
    const startTime = performance.now();
    const channel = new MessageChannel();
    const incoming = channel.port1;
    const outgoing = channel.port2;
    incoming.onmessage = (event: MessageEvent): void => {
        let currentTime = performance.now();
        let elapsed = currentTime - startTime;
        let duration = currentTime - event.data;
        if (duration > Setting.LongTask && elapsed < options.timeout) {
            requestAnimationFrame((): void => { outgoing.postMessage(currentTime); });
        } else {
            let didTimeout = elapsed > options.timeout;
            callback({
                didTimeout,
                timeRemaining: (): number => didTimeout ? Setting.LongTask : Math.max(0, Setting.LongTask - duration)
            });
        }
    };
    requestAnimationFrame((): void => { outgoing.postMessage(performance.now()); });
}

let requestIdleCallback = window["requestIdleCallback"] || requestIdleCallbackPolyfill;
