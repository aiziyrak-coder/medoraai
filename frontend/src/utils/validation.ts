/**
 * Validation utilities for form inputs and data
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates phone number (Uzbekistan format)
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: "Telefon raqami kiritilishi shart." };
  }
  
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Check Uzbekistan format: +998XXXXXXXXX or 998XXXXXXXXX
  const phoneRegex = /^(\+?998)?[0-9]{9}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { isValid: false, error: "Telefon raqami noto'g'ri formatda. Masalan: +998901234567" };
  }
  
  return { isValid: true };
};

/**
 * Validates age - realistik tibbiy chegaralar
 */
export const validateAge = (age: string | number): ValidationResult => {
  if (age === '' || age === null || age === undefined) {
    return { isValid: true }; // Bo'sh qiymat ruxsat etiladi
  }
  
  const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
  
  if (isNaN(ageNum)) {
    return { isValid: false, error: "Noto'g'ri qiymat. Faqat raqam kiriting." };
  }
  
  // Realistik tibbiy chegaralar: 0-120 yosh
  if (ageNum < 0) {
    return { isValid: false, error: "Yosh manfiy bo'lishi mumkin emas. Minimal qiymat: 0 yosh." };
  }
  
  if (ageNum > 120) {
    return { isValid: false, error: `Yosh ${ageNum} juda yuqori. Maksimal qiymat: 120 yosh. Bu hayotiy holat emas.` };
  }
  
  // Qo'shimcha: juda kichik yoshlar uchun (masalan, 0-1 yosh chaqaloqlar)
  if (ageNum === 0 && typeof age === 'string' && age.trim() !== '0') {
    return { isValid: false, error: "Noto'g'ri qiymat." };
  }
  
  return { isValid: true };
};

/**
 * Validates name (minimum length)
 */
export const validateName = (name: string, minLength: number = 2): ValidationResult => {
  if (!name || name.trim().length < minLength) {
    return { isValid: false, error: `Ism kamida ${minLength} belgidan iborat bo'lishi kerak.` };
  }
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲ\s'-]+$/u;
  if (!nameRegex.test(name.trim())) {
    return { isValid: false, error: "Ismda faqat harflar, probellar va tire ishlatilishi mumkin." };
  }
  
  return { isValid: true };
};

/**
 * Validates password strength
 */
export const validatePassword = (password: string, minLength: number = 6): ValidationResult => {
  if (!password || password.length < minLength) {
    return { isValid: false, error: `Parol kamida ${minLength} belgidan iborat bo'lishi kerak.` };
  }
  
  return { isValid: true };
};

/**
 * Validates file size
 */
export const validateFileSize = (file: File, maxSizeMB: number = 10): ValidationResult => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `Fayl hajmi ${maxSizeMB}MB dan oshmasligi kerak. Hozirgi hajm: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  
  return { isValid: true };
};

/**
 * Validates file type
 */
export const validateFileType = (
  file: File, 
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
): ValidationResult => {
  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes
      .map(type => {
        if (type.startsWith('image/')) return 'JPG, PNG';
        if (type === 'application/pdf') return 'PDF';
        if (type.includes('word')) return 'DOC, DOCX';
        return '';
      })
      .filter(Boolean)
      .join(', ');
    
    return { 
      isValid: false, 
      error: `Faqat quyidagi fayl turlari qabul qilinadi: ${allowedExtensions}` 
    };
  }
  
  return { isValid: true };
};

/**
 * Validates email (optional, for future use)
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: "Email kiritilishi shart." };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Email noto'g'ri formatda." };
  }
  
  return { isValid: true };
};

/**
 * Validates required field
 */
export const validateRequired = (value: string | number | null | undefined, fieldName: string = "Maydon"): ValidationResult => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    return { isValid: false, error: `${fieldName} to'ldirilishi shart.` };
  }
  
  return { isValid: true };
};

/**
 * Sanitizes string input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Validates vital signs ranges - tibbiy jihatdan realistik chegaralar
 */
export const validateVitalSign = (
  value: string | number,
  type: 'bpSystolic' | 'bpDiastolic' | 'heartRate' | 'temperature' | 'spO2' | 'respirationRate'
): ValidationResult => {
  if (value === '' || value === null || value === undefined) {
    return { isValid: true }; // Bo'sh qiymat ruxsat etiladi
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return { isValid: false, error: "Noto'g'ri qiymat. Faqat raqam kiriting." };
  }
  
  // Tibbiy jihatdan realistik chegaralar
  const ranges: Record<typeof type, { min: number; max: number; unit: string; errorMessage: string }> = {
    bpSystolic: { 
      min: 60, 
      max: 250, 
      unit: 'mm.Hg',
      errorMessage: 'Qon bosimi (SYS) 60-250 mm.Hg oralig\'ida bo\'lishi kerak. Bu hayotiy holat emas.'
    },
    bpDiastolic: { 
      min: 40, 
      max: 150, 
      unit: 'mm.Hg',
      errorMessage: 'Qon bosimi (DIA) 40-150 mm.Hg oralig\'ida bo\'lishi kerak. Bu hayotiy holat emas.'
    },
    heartRate: { 
      min: 30, 
      max: 220, 
      unit: 'bpm',
      errorMessage: 'Yurak urishi 30-220 bpm oralig\'ida bo\'lishi kerak. Bu hayotiy holat emas.'
    },
    temperature: { 
      min: 35.0, 
      max: 42.0, 
      unit: '°C',
      errorMessage: 'Tana harorati 35.0-42.0°C oralig\'ida bo\'lishi kerak. 45°C kabi qiymat hayotiy holat emas.'
    },
    spO2: { 
      min: 50, 
      max: 100, 
      unit: '%',
      errorMessage: 'Saturatsiya (SpO2) 50-100% oralig\'ida bo\'lishi kerak. Bu hayotiy holat emas.'
    },
    respirationRate: { 
      min: 5, 
      max: 60, 
      unit: '/min',
      errorMessage: 'Nafas soni 5-60 /min oralig\'ida bo\'lishi kerak. Bu hayotiy holat emas.'
    }
  };
  
  const range = ranges[type];
  
  if (numValue < range.min) {
    return { 
      isValid: false, 
      error: `Minimal qiymat: ${range.min} ${range.unit}. ${range.errorMessage}` 
    };
  }
  
  if (numValue > range.max) {
    return { 
      isValid: false, 
      error: `Maksimal qiymat: ${range.max} ${range.unit}. ${range.errorMessage}` 
    };
  }
  
  return { isValid: true };
};
