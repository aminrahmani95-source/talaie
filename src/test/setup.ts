/**
 * Vitest global setup.
 *
 * Node does not ship the Web Locks API (`navigator.locks`), but the Outbox engine
 * deliberately fails closed without it. This minimal in-memory polyfill implements the
 * subset the app uses (exclusive locks + `ifAvailable`) so queue tests run like a browser.
 */
type LockGrantedCallback<T> = (lock: { name: string; mode: 'exclusive' } | null) => Promise<T> | T;

class InMemoryLockManager {
  private held = new Set<string>();
  private waiters = new Map<string, Array<() => void>>();

  async request<T>(
    name: string,
    optionsOrCallback: { ifAvailable?: boolean; mode?: 'exclusive' | 'shared' } | LockGrantedCallback<T>,
    maybeCallback?: LockGrantedCallback<T>
  ): Promise<T> {
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback || {};
    const callback = (typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback) as LockGrantedCallback<T>;

    if (this.held.has(name)) {
      if (options.ifAvailable) return callback(null);
      await new Promise<void>((resolve) => {
        const queue = this.waiters.get(name) || [];
        queue.push(resolve);
        this.waiters.set(name, queue);
      });
    }

    this.held.add(name);
    try {
      return await callback({ name, mode: 'exclusive' });
    } finally {
      this.held.delete(name);
      const next = this.waiters.get(name)?.shift();
      if (next) next();
    }
  }

  async query() {
    return { held: [...this.held].map((name) => ({ name, mode: 'exclusive' })), pending: [] };
  }
}

if (typeof navigator !== 'undefined' && !(navigator as any).locks) {
  Object.defineProperty(navigator, 'locks', {
    value: new InMemoryLockManager(),
    configurable: true,
    writable: true,
  });
}
