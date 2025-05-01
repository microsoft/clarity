export default function throttle<T extends (...args: any[]) => void>(func: T, duration: number): T {
  let lastExecutionTime = 0;

  return function (...args: Parameters<T>) {
    const now = performance.now();

    // Execute immediaately for first instance, or after specified duration has elapsed
    if (lastExecutionTime === 0 || now - lastExecutionTime >= duration) {
      lastExecutionTime = now;
      func.apply(this, args);
    }
  } as T;
}