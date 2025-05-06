/**
 * Creates a throttled version of the provided function that only executes at most once
 * every specified duration in milliseconds.
 * @param func - The function to throttle.
 * @param duration - The duration in milliseconds to wait before allowing the next execution.
 * @returns A throttled version of the provided function.
 */
export default function throttle<T extends (...args: any[]) => void>(func: T, duration: number): T {
  let lastExecutionTime = 0;

  return function (...args: Parameters<T>) {
    const now = performance.now();

    // Execute immediately on first call or after the duration has elapsed
    if (lastExecutionTime === 0 || now - lastExecutionTime >= duration) {
      lastExecutionTime = now;
      func.apply(this, args);
    }
  } as T;
}