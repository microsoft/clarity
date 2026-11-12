/**
 * Creates a throttled version of the provided function that only executes at most once
 * every specified duration in milliseconds, ensuring the last event is not lost.
 * @param func - The function to throttle.
 * @param duration - The duration in milliseconds to wait before allowing the next execution.
 * @returns A throttled version of the provided function with a cleanup method.
 */
export default function throttle<T extends (...args: any[]) => void>(func: T, duration: number): T & { cleanup: () => void } {
  let lastExecutionTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  function throttledFunction(...args: Parameters<T>) {
    const now = performance.now();
    const timeSinceLastExecution = now - lastExecutionTime;

    // If the function is called during the throttling period, store the arguments to ensure we don't drop the last event
    if (lastExecutionTime !== 0 && timeSinceLastExecution < duration) {
      lastArgs = args;

      if (timeoutId) return;

      timeoutId = setTimeout(() => {
        lastExecutionTime = performance.now();
        func.apply(this, lastArgs!);
        lastArgs = null;
        timeoutId = null;
      }, duration - timeSinceLastExecution);
    } else {
      // Execute immediately if outside the throttling period (including the first run)
      lastExecutionTime = now;
      func.apply(this, args);
    }
  }

  // Add cleanup method to clear pending timeouts
  throttledFunction.cleanup = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return throttledFunction as T & { cleanup: () => void };
}
