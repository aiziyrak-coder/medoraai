/**
 * Production-safe logger utility
 * Replaces console.log/error/warn with environment-aware logging
 */

const isDevelopment = import.meta.env.DEV;

const LOG_PREFIX = "[Farg'ona JSTI]";

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(LOG_PREFIX, ...args);
    }
  },

  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(LOG_PREFIX + " ERROR", ...args);
    } else {
      console.error("[ERROR]", ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(LOG_PREFIX + " WARN", ...args);
    } else {
      console.warn("[WARN]", ...args);
    }
  },

  /** Python logging.warning / ba’zi servislar bilan mos nom */
  warning: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(LOG_PREFIX + " WARN", ...args);
    } else {
      console.warn("[WARN]", ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(LOG_PREFIX + " INFO", ...args);
    }
  }
};