/**
 * Timeout and timing constants
 */

export const TIMEOUTS = {
  // API timeouts
  API_REQUEST: 30000, // 30s
  API_RETRY_DELAY: 1000, // 1s
  API_MAX_RETRY_DELAY: 10000, // 10s
  API_HEALTH_CHECK: 5000, // 5s
  
  // UI delays
  DEBOUNCE_SEARCH: 300, // 300ms
  ANIMATION_SHORT: 500, // 500ms
  ANIMATION_MEDIUM: 1000, // 1s
  ANIMATION_LONG: 2000, // 2s
  
  // Queue/polling
  QUEUE_POLL_INTERVAL: 2000, // 2s (deprecated - use events)
  
  // Session
  SESSION_REFRESH_BUFFER: 60000, // 1min before expiry
} as const;

export const LIMITS = {
  // File uploads
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_ATTACHMENTS: 10,
  
  // Specialists
  MIN_SPECIALISTS: 4,
  MAX_SPECIALISTS: 10,
  
  // Vitals ranges
  VITALS: {
    BP_SYS: { min: 50, max: 300 },
    BP_DIA: { min: 30, max: 200 },
    HEART_RATE: { min: 30, max: 250 },
    TEMPERATURE: { min: 30, max: 45 },
    SPO2: { min: 50, max: 100 },
    RESPIRATION: { min: 5, max: 60 },
  },
  
  // Text lengths
  MAX_COMPLAINT_LENGTH: 2000,
  MAX_NOTE_LENGTH: 5000,
} as const;
