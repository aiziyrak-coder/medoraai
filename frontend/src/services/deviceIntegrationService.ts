import type { VitalSigns } from '../types';

let intervalId: number | null = null;
let dataCallback: ((vitals: VitalSigns) => void) | null = null;

const generateRandomVitals = (): VitalSigns => {
    // Generates values around a baseline to simulate a real patient
    const baseHR = 75;
    const baseSpO2 = 98;
    const baseBPS = 120;
    const baseBPD = 80;
    const baseRR = 16;

    return {
        heartRate: baseHR + Math.floor(Math.random() * 10) - 5,
        spO2: Math.min(100, baseSpO2 + Math.floor(Math.random() * 3) - 1),
        bpSystolic: baseBPS + Math.floor(Math.random() * 12) - 6,
        bpDiastolic: baseBPD + Math.floor(Math.random() * 8) - 4,
        respirationRate: baseRR + Math.floor(Math.random() * 4) - 2,
    };
};

export const connect = () => {
    if (intervalId) return; // Already connected

    intervalId = window.setInterval(() => {
        if (dataCallback) {
            dataCallback(generateRandomVitals());
        }
    }, 1200); // Update every 1.2 seconds
};

export const disconnect = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    dataCallback = null;
};

export const onData = (callback: (vitals: VitalSigns) => void) => {
    dataCallback = callback;
};
