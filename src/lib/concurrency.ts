/**
 * Concurrency limiter — runs at most `limit` async functions at a time.
 * Usage: const run = pLimit(2); await Promise.all(items.map(i => run(() => process(i))));
 */
export function pLimit(limit: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (queue.length > 0 && active < limit) {
      active++;
      const resolve = queue.shift()!;
      resolve();
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
      };

      if (active < limit) {
        active++;
        run();
      } else {
        queue.push(run);
      }
    });
  };
}
