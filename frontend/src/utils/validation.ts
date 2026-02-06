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
 * Validates age
 */
export const validateAge = (age: string | number): ValidationResult => {
  const ageNum = typeof age === 'string' ? parseInt(age, 10) : age;
  
  if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
    return { isValid: false, error: "Yosh 0 dan 150 gacha bo'lishi kerak." };
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
 * Validates vital signs ranges
 */
export const validateVitalSign = (
  value: string | number,
  type: 'bpSystolic' | 'bpDiastolic' | 'heartRate' | 'temperature' | 'spO2' | 'respirationRate'
): ValidationResult => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return { isValid: false, error: "Noto'g'ri qiymat." };
  }
  
  const ranges: Record<typeof type, { min: number; max: number; unit: string }> = {
    bpSystolic: { min: 50, max: 250, unit: 'mm.Hg' },
    bpDiastolic: { min: 30, max: 150, unit: 'mm.Hg' },
    heartRate: { min: 30, max: 220, unit: 'bpm' },
    temperature: { min: 30, max: 45, unit: '°C' },
    spO2: { min: 0, max: 100, unit: '%' },
    respirationRate: { min: 0, max: 60, unit: '/min' }
  };
  
  const range = ranges[type];
  
  if (numValue < range.min || numValue > range.max) {
    return { 
      isValid: false, 
      error: `${type} ${range.min}-${range.max} ${range.unit} oralig'ida bo'lishi kerak.` 
    };
  }
  
  return { isValid: true };
};
