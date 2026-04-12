/** Logs only in Vite dev — no sensitive data in production DevTools. */
const dev = import.meta.env.DEV;

export function devLog(...args: unknown[]): void {
  if (dev) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (dev) console.warn(...args);
}

export function devError(...args: unknown[]): void {
  if (dev) console.error(...args);
}
