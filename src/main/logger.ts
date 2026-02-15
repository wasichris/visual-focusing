export class Logger {
  private static instance: Logger;
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.warn(
        `[WARN] ${new Date().toISOString()} - ${message}`,
        ...args
      );
    }
  }

  error(message: string, error?: unknown): void {
    if (this.enabled) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
      if (error) {
        console.error(error);
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled && process.env.NODE_ENV === 'development') {
      console.debug(
        `[DEBUG] ${new Date().toISOString()} - ${message}`,
        ...args
      );
    }
  }
}

export const logger = Logger.getInstance();
