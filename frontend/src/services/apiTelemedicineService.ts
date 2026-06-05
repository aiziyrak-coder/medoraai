import { apiGet, apiPost, type ApiResponse } from './api';

export interface TeleSessionData {
  room_code: string;
  session_id: number;
}

export interface TeleSignalData {
  offer_sdp: string;
  answer_sdp: string;
  ice_candidates: unknown[];
}

export const createTeleSession = async (
  patientLabel = '',
): Promise<ApiResponse<TeleSessionData>> => {
  return apiPost<TeleSessionData>('/telemedicine/sessions/', { patient_label: patientLabel });
};

export const getTeleSignal = async (roomCode: string): Promise<ApiResponse<TeleSignalData>> => {
  return apiGet<TeleSignalData>(`/telemedicine/signal/${encodeURIComponent(roomCode)}/`);
};

export const postTeleSignal = async (
  roomCode: string,
  payload: { type: 'offer' | 'answer' | 'ice'; sdp?: string; candidate?: unknown },
): Promise<ApiResponse<unknown>> => {
  return apiPost(`/telemedicine/signal/${encodeURIComponent(roomCode)}/`, payload);
};
