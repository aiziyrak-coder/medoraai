
import type { PatientQueueItem } from '../types';

const QUEUE_KEY_PREFIX = 'medora_queue_';

// Get queue key for a specific doctor
const getQueueKey = (doctorId: string) => `${QUEUE_KEY_PREFIX}${doctorId}`;

export const getQueue = (doctorId: string): PatientQueueItem[] => {
    try {
        const data = localStorage.getItem(getQueueKey(doctorId));
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
};

export const saveQueue = (doctorId: string, queue: PatientQueueItem[]) => {
    localStorage.setItem(getQueueKey(doctorId), JSON.stringify(queue));
    // Dispatch event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
        key: getQueueKey(doctorId),
        newValue: JSON.stringify(queue)
    }));
};

export const addToQueue = (doctorId: string, patient: Omit<PatientQueueItem, 'id' | 'status' | 'ticketNumber' | 'patientName'>) => {
    const currentQueue = getQueue(doctorId);
    
    // Generate simple ticket number
    const maxTicket = currentQueue.reduce((max, p) => Math.max(max, p.ticketNumber), 0);
    const newTicket = maxTicket + 1;

    const newItem: PatientQueueItem = {
        ...patient,
        patientName: `${patient.lastName} ${patient.firstName}`, // Construct full name for display
        id: Date.now().toString(),
        status: 'waiting',
        ticketNumber: newTicket
    };

    const updatedQueue = [...currentQueue, newItem];
    saveQueue(doctorId, updatedQueue);
    return newItem;
};

export const updatePatientStatus = (doctorId: string, patientId: string, status: PatientQueueItem['status']) => {
    const currentQueue = getQueue(doctorId);
    const patientIndex = currentQueue.findIndex(p => p.id === patientId);
    
    if (patientIndex === -1) return;

    const patient = { ...currentQueue[patientIndex], status };
    
    // Remove from current position
    let newQueue = [...currentQueue];
    newQueue.splice(patientIndex, 1);

    if (status === 'waiting') {
        // PRIORITY LOGIC: If returning to 'waiting' (from hold), put at the TOP of the waiting list
        // Find the index of the first 'waiting' item
        const firstWaitingIndex = newQueue.findIndex(p => p.status === 'waiting');
        if (firstWaitingIndex === -1) {
            // No one waiting, just push (but before completed/hold usually, logic depends on sort)
            // Ideally we insert before any other 'waiting' patient.
            // Since we removed it, we need to find where to put it.
            // Let's filter and reconstruct to be safe.
            const waiting = newQueue.filter(p => p.status === 'waiting');
            const others = newQueue.filter(p => p.status !== 'waiting');
            newQueue = [patient, ...waiting, ...others];
        } else {
            // Insert at the very specific index of the first waiting person
            newQueue.splice(firstWaitingIndex, 0, patient);
        }
    } else {
        // For other statuses (hold, completed, in-progress), just update in place (or append)
        // Ideally, we keep the original order or grouped by status. 
        // For simplicity in this app, we just place it back or append. 
        const simpleUpdateQueue = getQueue(doctorId).map(p => 
            p.id === patientId ? { ...p, status } : p
        );
        newQueue = simpleUpdateQueue;
    }

    saveQueue(doctorId, newQueue);
};

export const updatePatientDetails = (doctorId: string, patientId: string, details: Partial<PatientQueueItem>) => {
    const currentQueue = getQueue(doctorId);
    const updatedQueue = currentQueue.map(p => {
        if (p.id === patientId) {
            const updated = { ...p, ...details };
            // Update the display name if names changed
            updated.patientName = `${updated.lastName} ${updated.firstName}`;
            return updated;
        }
        return p;
    });
    saveQueue(doctorId, updatedQueue);
};

export const removeFromQueue = (doctorId: string, patientId: string) => {
    const currentQueue = getQueue(doctorId);
    const updatedQueue = currentQueue.filter(p => p.id !== patientId);
    saveQueue(doctorId, updatedQueue);
};

export const subscribeToQueueUpdates = (doctorId: string, callback: (queue: PatientQueueItem[]) => void) => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === getQueueKey(doctorId) && e.newValue) {
            callback(JSON.parse(e.newValue));
        }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also use a poller for same-tab updates if not strictly relying on events
    const interval = setInterval(() => {
        const q = getQueue(doctorId);
        callback(q);
    }, 2000);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
    };
};
