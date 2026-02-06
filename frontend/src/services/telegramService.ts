/**
 * Payment receipt: sends via backend API (token never exposed to frontend).
 * Falls back to "service not configured" if API is unavailable.
 */
import { apiUpload } from './api';
import { logger } from '../utils/logger';

export const sendPaymentReceipt = async (
    file: File,
    user: { name: string; phone: string; role: string },
    amount: number,
    planId?: number
): Promise<{ success: boolean; message?: string }> => {
    try {
        const additionalData: Record<string, string> = {
            user_name: user.name,
            user_phone: user.phone,
            user_role: user.role,
            amount: String(amount),
        };
        if (planId != null) {
            additionalData.plan_id = String(planId);
        }
        const response = await apiUpload<{ message?: string }>(
            '/auth/send-payment-receipt/',
            file,
            additionalData
        );

        if (response.success) {
            return { success: true };
        }
        const msg = response.error?.message || 'To\'lov chekini yuborishda xatolik.';
        return { success: false, message: msg };
    } catch (error) {
        logger.error('Payment receipt upload failed:', error);
        return {
            success: false,
            message: 'Tizim xatoligi. Iltimos, backend ishlayotganligini tekshiring.',
        };
    }
};
