
// This service simulates a URL shortener backend using localStorage
// In production, this would be a database mapping table.

const TV_MAPPING_KEY = 'medora_tv_mapping';

interface TvMapping {
    [shortCode: string]: string; // shortCode -> doctorId
}

const getMappings = (): TvMapping => {
    try {
        const data = localStorage.getItem(TV_MAPPING_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

const saveMappings = (mappings: TvMapping) => {
    localStorage.setItem(TV_MAPPING_KEY, JSON.stringify(mappings));
};

export const getOrGenerateTvCode = (doctorId: string): string => {
    const mappings = getMappings();
    
    // Check if code exists for doctor
    const existingCode = Object.keys(mappings).find(key => mappings[key] === doctorId);
    if (existingCode) return existingCode;

    // Generate new unique 8-char code
    let newCode = '';
    do {
        newCode = Math.random().toString(36).substring(2, 10);
    } while (mappings[newCode]); // Ensure uniqueness

    mappings[newCode] = doctorId;
    saveMappings(mappings);
    return newCode;
};

export const getDoctorIdByCode = (code: string): string | null => {
    const mappings = getMappings();
    return mappings[code] || null;
};

export const getTvUrl = (code: string): string => {
    const currentUrl = window.location.href;
    
    // Fix: Handle blob URLs (common in preview environments like StackBlitz/CodeSandbox)
    // Blob URLs do not support standard query parameters in a way that allows navigation.
    // We use the hash fragment instead for blob URLs.
    if (window.location.protocol === 'blob:') {
        // For blob URLs, we append the code as a hash. 
        // Note: new URL(blob) with search params might fail or be treated as a different file.
        // We do string manipulation to be safe with blob protocol quirks.
        const baseUrl = currentUrl.split('#')[0].split('?')[0];
        return `${baseUrl}#tv=${code}`;
    }

    // Standard environment (http/https/localhost)
    const url = new URL(currentUrl);
    url.search = `?tv=${code}`;
    url.hash = ''; // Clear hash if present to ensure clean URL
    return url.toString();
};
