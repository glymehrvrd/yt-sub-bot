export function logger(name: string) {
  return {
    debug: (message: string, ...args: any[]) => console.debug(`[${name}] DEBUG:`, message, ...args),
    info: (message: string, ...args: any[]) => console.log(`[${name}] INFO:`, message, ...args),
    error: (message: string, ...args: any[]) => console.error(`[${name}] ERROR:`, message, ...args),
    warning: (message: string, ...args: any[]) => console.warn(`[${name}] WARN:`, message, ...args),
  };
}
