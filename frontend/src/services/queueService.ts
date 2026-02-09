import type { PatientQueueItem } from '../types';
import { isApiConfigured } from '../config/api';
import { getAuthToken } from './api';
import * as apiQueue from './apiQueueService';

const QUEUE_KEY_PREFIX = 'medora_queue_';

// Server navbati uchun cache (barcha qurilmalarda bir xil)
let queueCache: PatientQueueItem[] = [];

const getQueueKey = (doctorId: string) => `${QUEUE_KEY_PREFIX}${doctorId}`;

function isQueueApiMode(): boolean {
  return isApiConfigured() && !!getAuthToken();
}

/** Navbat ro'yxati — API bo'lsa cache, aks holda localStorage */
export const getQueue = (doctorId: string): PatientQueueItem[] => {
  if (isQueueApiMode()) return [...queueCache];
  try {
    const data = localStorage.getItem(getQueueKey(doctorId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/** Serverdan navbatni yuklash (API rejimida), yoki localStorage (API yo‘q bo‘lsa) */
export const loadQueueFromServer = async (doctorId: string): Promise<PatientQueueItem[]> => {
  if (!isQueueApiMode()) return getQueue(doctorId);
  const res = await apiQueue.apiGetQueue();
  if (res.ok && res.data) {
    queueCache = res.data;
    return res.data;
  }
  return queueCache;
};

export const saveQueue = (doctorId: string, queue: PatientQueueItem[]) => {
  if (isQueueApiMode()) {
    queueCache = queue;
    return;
  }
  localStorage.setItem(getQueueKey(doctorId), JSON.stringify(queue));
  window.dispatchEvent(new StorageEvent('storage', {
    key: getQueueKey(doctorId),
    newValue: JSON.stringify(queue)
  }));
};

export const addToQueue = async (
  doctorId: string,
  patient: Omit<PatientQueueItem, 'id' | 'status' | 'ticketNumber' | 'patientName'>
): Promise<PatientQueueItem> => {
  if (isQueueApiMode()) {
    const res = await apiQueue.apiAddToQueue({
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: patient.age,
      address: patient.address,
      complaints: patient.complaints,
      arrivalTime: patient.arrivalTime
    });
    if (res.ok && res.data) {
      queueCache = [...queueCache, res.data];
      return res.data;
    }
    throw new Error(res.error || 'Navbatga qo\'shish amalga oshmadi');
  }
  const currentQueue = getQueue(doctorId);
  const maxTicket = currentQueue.reduce((max, p) => Math.max(max, p.ticketNumber), 0);
  const newItem: PatientQueueItem = {
    ...patient,
    patientName: `${patient.lastName} ${patient.firstName}`,
    id: Date.now().toString(),
    status: 'waiting',
    ticketNumber: maxTicket + 1
  };
  const updatedQueue = [...currentQueue, newItem];
  saveQueue(doctorId, updatedQueue);
  return newItem;
};

export const updatePatientStatus = async (
  doctorId: string,
  patientId: string,
  status: PatientQueueItem['status']
): Promise<void> => {
  if (isQueueApiMode()) {
    const res = await apiQueue.apiUpdateQueueItem(patientId, { status });
    if (res.ok && res.data) {
      queueCache = queueCache.map(p => p.id === patientId ? res.data! : p);
      return;
    }
    throw new Error(res.error || 'Status yangilanmadi');
  }
  const currentQueue = getQueue(doctorId);
  const patientIndex = currentQueue.findIndex(p => p.id === patientId);
  if (patientIndex === -1) return;
  const patient = { ...currentQueue[patientIndex], status };
  let newQueue = [...currentQueue];
  newQueue.splice(patientIndex, 1);
  if (status === 'waiting') {
    const firstWaitingIndex = newQueue.findIndex(p => p.status === 'waiting');
    if (firstWaitingIndex === -1) {
      const waiting = newQueue.filter(p => p.status === 'waiting');
      const others = newQueue.filter(p => p.status !== 'waiting');
      newQueue = [patient, ...waiting, ...others];
    } else {
      newQueue.splice(firstWaitingIndex, 0, patient);
    }
  } else {
    newQueue = currentQueue.map(p => (p.id === patientId ? { ...p, status } : p));
  }
  saveQueue(doctorId, newQueue);
};

export const updatePatientDetails = async (
  doctorId: string,
  patientId: string,
  details: Partial<PatientQueueItem>
): Promise<void> => {
  if (isQueueApiMode()) {
    const payload: Parameters<typeof apiQueue.apiUpdateQueueItem>[1] = {};
    if (details.firstName !== undefined) payload.firstName = details.firstName;
    if (details.lastName !== undefined) payload.lastName = details.lastName;
    if (details.age !== undefined) payload.age = details.age;
    if (details.address !== undefined) payload.address = details.address;
    if (details.complaints !== undefined) payload.complaints = details.complaints;
    const res = await apiQueue.apiUpdateQueueItem(patientId, payload);
    if (res.ok && res.data) {
      queueCache = queueCache.map(p => (p.id === patientId ? res.data! : p));
      return;
    }
    throw new Error(res.error || 'Ma\'lumot yangilanmadi');
  }
  const currentQueue = getQueue(doctorId);
  const updatedQueue = currentQueue.map(p => {
    if (p.id !== patientId) return p;
    const updated = { ...p, ...details };
    updated.patientName = `${updated.lastName} ${updated.firstName}`;
    return updated;
  });
  saveQueue(doctorId, updatedQueue);
};

export const removeFromQueue = async (doctorId: string, patientId: string): Promise<void> => {
  if (isQueueApiMode()) {
    const res = await apiQueue.apiRemoveFromQueue(patientId);
    if (res.ok) {
      queueCache = queueCache.filter(p => p.id !== patientId);
      return;
    }
    throw new Error(res.error || 'O\'chirish amalga oshmadi');
  }
  const currentQueue = getQueue(doctorId);
  saveQueue(doctorId, currentQueue.filter(p => p.id !== patientId));
};

export const subscribeToQueueUpdates = (
  doctorId: string,
  callback: (queue: PatientQueueItem[]) => void
): (() => void) => {
  if (isQueueApiMode()) {
    const interval = setInterval(async () => {
      await loadQueueFromServer(doctorId);
      callback(getQueue(doctorId));
    }, 5000);
    return () => clearInterval(interval);
  }
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === getQueueKey(doctorId) && e.newValue) callback(JSON.parse(e.newValue));
  };
  window.addEventListener('storage', handleStorageChange);
  const interval = setInterval(() => callback(getQueue(doctorId)), 2000);
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(interval);
  };
};
