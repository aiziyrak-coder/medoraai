
const SETTINGS_KEY_PREFIX = 'medora_tv_settings_';

export interface TvSettings {
    isUnlocked: boolean;
    videoUrl: string; // If empty, use default. Can be comma separated list.
    scrollingText: string;
}

const getSettingsKey = (doctorId: string) => `${SETTINGS_KEY_PREFIX}${doctorId}`;

export const getTvSettings = (doctorId: string): TvSettings => {
    try {
        const data = localStorage.getItem(getSettingsKey(doctorId));
        return data ? JSON.parse(data) : {
            isUnlocked: false,
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4, https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            scrollingText: "Klinikamizda yangi kardiologiya bo'limi ochildi! • Chegirmalar haftaligi davom etmoqda!"
        };
    } catch (e) {
        return { isUnlocked: false, videoUrl: '', scrollingText: '' };
    }
};

export const saveTvSettings = (doctorId: string, settings: TvSettings) => {
    localStorage.setItem(getSettingsKey(doctorId), JSON.stringify(settings));
    // Trigger storage event for cross-tab sync (TV display)
    window.dispatchEvent(new StorageEvent('storage', {
        key: getSettingsKey(doctorId),
        newValue: JSON.stringify(settings)
    }));
};

// Generates a specific unlock code for a doctor based on their phone number
export const generateUnlockCode = (phone: string): string => {
    // Logic: "MEDORA-" + Last 4 digits of phone
    const cleanPhone = phone.replace(/\D/g, '');
    const suffix = cleanPhone.slice(-4);
    return `MEDORA-${suffix}`;
};

export const subscribeToSettingsUpdates = (doctorId: string, callback: (settings: TvSettings) => void) => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === getSettingsKey(doctorId) && e.newValue) {
            callback(JSON.parse(e.newValue));
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
};
