/** Logs only in dev builds — nothing sensitive in production logs. */
export function devLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}

export function devError(...args: unknown[]): void {
  if (__DEV__) console.error(...args);
}
