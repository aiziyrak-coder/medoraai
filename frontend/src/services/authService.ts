
import type { User, AnalysisRecord, SubscriptionStatus } from '../types';
import { validatePhone, validateName, validatePassword, type ValidationResult } from '../utils/validation';

const USERS_KEY = 'tibiy_kengash_users_v6'; // Incremented key to reset and apply new defaults
const ANALYSES_KEY = 'tibiy_kengash_analyses';
const CURRENT_USER_KEY = 'tibiy_kengash_current_user_phone'; // Storing only phone

type UserStore = Record<string, User>;

// --- User Management ---

const getUsers = (): UserStore => {
    try {
        const usersJSON = localStorage.getItem(USERS_KEY);
        const users = usersJSON ? JSON.parse(usersJSON) : {};

        // 1. Clinic (Admin) Demo - Always Active
        if (!users['+998901234567']) {
            users['+998901234567'] = {
                phone: '+998901234567',
                password: 'clinic_demo',
                name: 'Markaziy Klinika',
                role: 'clinic',
                subscriptionStatus: 'active' 
            };
        }

        // 2. Doctor Demo (Active Subscription) - For testing main features
        if (!users['+998901111111']) {
            users['+998901111111'] = {
                phone: '+998901111111',
                password: 'demo',
                name: 'Dr. Active',
                role: 'doctor',
                specialties: ['Kardiologiya', 'Terapiya'],
                subscriptionStatus: 'active' 
            };
        }

        // 3. Doctor Demo (Inactive Subscription) - For testing payment flow
        if (!users['+998902222222']) {
            users['+998902222222'] = {
                phone: '+998902222222',
                password: 'demo',
                name: 'Dr. Inactive',
                role: 'doctor',
                specialties: ['Nevrologiya'],
                subscriptionStatus: 'inactive' 
            };
        }
        
        saveUsers(users);
        return users;
    } catch (e) {
        return {};
    }
};

const saveUsers = (users: UserStore) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const register = (user: User): { success: boolean, message: string } => {
    // Validate phone number
    const phoneValidation = validatePhone(user.phone);
    if (!phoneValidation.isValid) {
        return { success: false, message: phoneValidation.error || "Telefon raqami noto'g'ri." };
    }
    
    // Validate name
    const nameValidation = validateName(user.name, 3);
    if (!nameValidation.isValid) {
        return { success: false, message: nameValidation.error || "Ism noto'g'ri." };
    }
    
    // Validate password
    if (user.password) {
        const passwordValidation = validatePassword(user.password, 6);
        if (!passwordValidation.isValid) {
            return { success: false, message: passwordValidation.error || "Parol noto'g'ri." };
        }
    }
    
    const users = getUsers();
    if (users[user.phone]) {
        return { success: false, message: "Bu telefon raqami allaqachon ro'yxatdan o'tgan." };
    }
    
    if (user.role === 'doctor' && (!user.specialties || user.specialties.length === 0)) {
        return { success: false, message: "Kamida bitta mutaxassislik tanlanishi shart." };
    }

    // Default subscription status for new users is 'inactive'
    const newUser: User = {
        ...user,
        subscriptionStatus: 'inactive'
    };

    users[user.phone] = newUser;
    saveUsers(users);
    return { success: true, message: "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi." };
};

export const login = (credentials: { phone: string, password?: string }): { success: boolean, message: string } => {
    const users = getUsers();
    const storedUser = users[credentials.phone];
    
    if (!storedUser) {
        return { success: false, message: "Bu telefon raqami topilmadi." };
    }
    if (storedUser.password !== credentials.password) {
        return { success: false, message: "Parol noto'g'ri." };
    }
    localStorage.setItem(CURRENT_USER_KEY, credentials.phone);
    return { success: true, message: "Tizimga muvaffaqiyatli kirdingiz." };
};

export const logout = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
    const phone = localStorage.getItem(CURRENT_USER_KEY);
    if (!phone) {
        return null;
    }
    const users = getUsers();
    const storedUser = users[phone];
    if (!storedUser) {
        logout();
        return null;
    }
    return storedUser;
};

export const updateUserSubscription = (phone: string, status: SubscriptionStatus) => {
    const users = getUsers();
    if (users[phone]) {
        users[phone].subscriptionStatus = status;
        saveUsers(users);
        // Ensure current session reflects this if needed, though react state usually handles re-renders via App.tsx check
    }
};

// --- Staff Management ---

export const getAssistant = (doctorId: string): User | null => {
    const users = getUsers();
    const doctor = users[doctorId];
    if (doctor && doctor.assistantId && users[doctor.assistantId]) {
        return users[doctor.assistantId];
    }
    return null;
};

export const upsertAssistant = (doctorId: string, assistantData: { phone: string, name: string, password?: string }): { success: boolean, message: string } => {
    const users = getUsers();
    
    // Check if doctor exists
    if (!users[doctorId]) return { success: false, message: "Shifokor topilmadi." };

    // Check if phone number is taken by someone else (not the current assistant)
    if (users[assistantData.phone] && users[assistantData.phone].linkedDoctorId !== doctorId) {
        return { success: false, message: "Bu telefon raqami band." };
    }

    // If updating existing assistant
    let existingAssistantId = users[doctorId].assistantId;
    
    // If phone changed, we need to handle key migration, simpler to delete old and create new for this mock DB
    if (existingAssistantId && existingAssistantId !== assistantData.phone) {
        delete users[existingAssistantId];
    }

    const assistant: User = {
        phone: assistantData.phone,
        name: assistantData.name,
        password: assistantData.password || users[existingAssistantId || '']?.password || '123456', // Keep old password if not provided
        role: 'staff',
        linkedDoctorId: doctorId,
        subscriptionStatus: 'active' // Staff inherit active status essentially (checked via doctor usually)
    };

    users[assistantData.phone] = assistant;
    users[doctorId].assistantId = assistantData.phone;
    
    saveUsers(users);
    return { success: true, message: "Yordamchi ma'lumotlari saqlandi." };
};

export const deleteAssistant = (doctorId: string) => {
    const users = getUsers();
    const assistantId = users[doctorId]?.assistantId;
    if (assistantId && users[assistantId]) {
        delete users[assistantId];
        delete users[doctorId].assistantId;
        saveUsers(users);
    }
};

export const getUserCount = (): number => {
    const users = getUsers();
    return Object.keys(users).length;
};

export const requestPasswordReset = (phone: string): { success: boolean, message: string } => {
    // In production, this would send an actual password reset email/SMS
    // For now, we just return success message
    return { 
        success: true, 
        message: "Agar ushbu raqam uchun hisob mavjud bo'lsa, tiklash yo'riqnomasi yuborildi." 
    };
};


// --- Analysis Management ---

const getAllAnalyses = (): Record<string, AnalysisRecord[]> => {
    try {
        const analyses = localStorage.getItem(ANALYSES_KEY);
        return analyses ? JSON.parse(analyses) : {};
    } catch (e) {
        return {};
    }
};

const saveAllAnalyses = (analyses: Record<string, AnalysisRecord[]>) => {
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
};

export const saveAnalysis = (phone: string, record: AnalysisRecord) => {
    const allAnalyses = getAllAnalyses();
    if (!allAnalyses[phone]) {
        allAnalyses[phone] = [];
    }
    allAnalyses[phone].unshift(record); 
    saveAllAnalyses(allAnalyses);
};

export const updateAnalysis = (phone: string, recordToUpdate: AnalysisRecord) => {
    const allAnalyses = getAllAnalyses();
    if (!allAnalyses[phone]) {
        return;
    }
    const recordIndex = allAnalyses[phone].findIndex(r => r.id === recordToUpdate.id);
    if (recordIndex > -1) {
        allAnalyses[phone][recordIndex] = recordToUpdate;
        saveAllAnalyses(allAnalyses);
    } else {
        // Record not found - this is expected in some edge cases, silently handle
        // Could log in development mode if needed
    }
};

export const getAnalyses = (phone: string): AnalysisRecord[] => {
    const allAnalyses = getAllAnalyses();
    return allAnalyses[phone] || [];
};
