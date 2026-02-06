/**
 * Input sanitization utilities for XSS protection
 */

/**
 * Sanitizes HTML string to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
};

/**
 * Escapes special characters in a string
 */
export const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Sanitizes user input for safe display
 */
export const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Remove potentially dangerous characters and scripts
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
};

/**
 * Validates and sanitizes phone number
 */
export const sanitizePhone = (phone: string): string => {
    // Remove all non-digit characters except +
    return phone.replace(/[^\d+]/g, '');
};

/**
 * Validates and sanitizes email
 */
export const sanitizeEmail = (email: string): string => {
    // Basic email sanitization
    return email.trim().toLowerCase().replace(/[^\w@.-]/g, '');
};
