/**
 * Production-safe logger utility
 * Replaces console.log/error/warn with environment-aware logging
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log('[Farg'ona JSTI]', ...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Always log errors, but format them properly
    if (isDevelopment) {
      console.error('[Farg'ona JSTI ERROR]', ...args);
    } else {
      // In production, you might want to send to error tracking service
      // For now, we'll still log but in a more controlled way
      console.error('[ERROR]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn('[Farg'ona JSTI WARN]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[Farg'ona JSTI INFO]', ...args);
    }
  }
};