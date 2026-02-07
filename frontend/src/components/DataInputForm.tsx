
import React, { useState, useRef, useCallback } from 'react';
import type { PatientData } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import UploadCloudIcon from './icons/UploadCloudIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import { useTranslation } from '../hooks/useTranslation';
import DocumentTextIcon from './icons/DocumentTextIcon';
import { validateFileSize, validateFileType, validateAge, validateRequired, validateVitalSign } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import { validatePatientDataSmart, getSmartValidationMessage } from '../utils/smartValidation';

interface DataInputFormProps {
    isAnalyzing: boolean;
    onSubmit: (data: PatientData) => void;
}

// Ultra-compact Input component (label/placeholder yaxshi ko‘rinishi uchun qorong‘u matn)
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }> = ({ id, label, className, ...props }) => (
    <div className={`flex flex-col ${className}`}>
        <label htmlFor={id} className="text-[10px] font-bold text-slate-700 uppercase tracking-wide ml-1 mb-0.5">
            {label}
        </label>
        <input id={id} {...props} className="block w-full text-xs text-slate-800 common-input py-1.5 px-2 bg-white/80 focus:bg-white placeholder-slate-500 transition-all duration-200 border border-slate-200 shadow-sm focus:ring-1 focus:ring-blue-400 rounded-lg" />
    </div>
);

// Ultra-compact Textarea with flexible height
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string }> = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string }>(({ id, label, className, ...props }, ref) => (
     <div className={`flex flex-col h-full ${className}`}>
        <label htmlFor={id} className="text-[10px] font-bold text-slate-700 uppercase tracking-wide ml-1 mb-0.5">
            {label}
        </label>
        <textarea id={id} {...props} className="block w-full flex-grow text-xs text-slate-800 common-input py-2 px-2 bg-white/80 focus:bg-white placeholder-slate-500 border border-slate-200 transition-all duration-200 shadow-sm focus:ring-1 focus:ring-blue-400 resize-none rounded-lg" ref={ref} />
    </div>
));

const VitalInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; unit: string; id?: string }> = ({ label, unit, id, ...props }) => {
    const inputId = id || `vital-${label.replace(/\s+/g, '-').toLowerCase()}`;
    return (
        <div className="bg-white/70 p-1.5 rounded-lg border border-slate-200 flex flex-col justify-between">
            <label htmlFor={inputId} className="text-[9px] font-bold text-slate-700 uppercase">{label}</label>
            <div className="flex items-baseline gap-1">
                <input id={inputId} name={inputId} aria-label={label} {...props} className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none p-0" placeholder="0" />
                <span className="text-[9px] text-slate-600">{unit}</span>
            </div>
        </div>
    );
};

const DataInputForm: React.FC<DataInputFormProps> = ({ isAnalyzing, onSubmit }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Partial<PatientData>>({
        firstName: '',
        lastName: '',
        age: '',
        gender: '',
        complaints: '',
        history: '',
        allergies: '',
        currentMedications: '',
        familyHistory: '',
        additionalInfo: '',
    });
    
    // Vitals State
    const [vitals, setVitals] = useState({
        bpSystolic: '',
        bpDiastolic: '',
        heartRate: '',
        temperature: '',
        spO2: '',
        respirationRate: ''
    });

    const [attachments, setAttachments] = useState<File[]>([]);
    const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [smartMessage, setSmartMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Aqlli validatsiya: form ma'lumotlari o'zgarganda maslahat/warning yangilash
    React.useEffect(() => {
        const payload: Partial<PatientData> = {
            ...formData,
            objectiveData: vitals.bpSystolic || vitals.heartRate ? 'Vitals kiritilgan' : undefined,
        };
        const res = validatePatientDataSmart(payload);
        const msg = getSmartValidationMessage(res, t);
        setSmartMessage(msg);
    }, [formData, vitals.bpSystolic, vitals.heartRate, t]);

    const handleChange = (field: keyof PatientData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (formErrors[field]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleVitalChange = (field: keyof typeof vitals, value: string) => {
        setVitals(prev => ({ ...prev, [field]: value }));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        
        const newFiles = Array.from(e.target.files);
        const errors: Record<string, string> = {};
        
        newFiles.forEach(file => {
            // Validate file size (max 10MB)
            const sizeValidation = validateFileSize(file, 10);
            if (!sizeValidation.isValid) {
                errors[file.name] = sizeValidation.error || "Fayl hajmi juda katta.";
                return;
            }
            
            // Validate file type
            const typeValidation = validateFileType(file);
            if (!typeValidation.isValid) {
                errors[file.name] = typeValidation.error || "Fayl turi qo'llab-quvvatlanmaydi.";
                return;
            }
        });
        
        // Only add files without errors
        const validFiles = newFiles.filter(file => !errors[file.name]);
        
        if (validFiles.length > 0) {
            setAttachments(prev => [...prev, ...validFiles]);
        }
        
        if (Object.keys(errors).length > 0) {
            setFileErrors(prev => ({ ...prev, ...errors }));
            // Clear errors after 5 seconds
            setTimeout(() => {
                setFileErrors({});
            }, 5000);
        }
        
        // Reset input
        e.target.value = '';
    };

    const removeAttachment = useCallback((fileName: string) => {
        setAttachments(prev => prev.filter(f => f.name !== fileName));
        // Clear error if file was removed
        if (fileErrors[fileName]) {
            setFileErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fileName];
                return newErrors;
            });
        }
    }, [fileErrors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required fields
        const errors: Record<string, string> = {};
        
        const firstNameValidation = validateRequired(formData.firstName, "Ism");
        if (!firstNameValidation.isValid) errors.firstName = firstNameValidation.error || "";
        
        const lastNameValidation = validateRequired(formData.lastName, "Familiya");
        if (!lastNameValidation.isValid) errors.lastName = lastNameValidation.error || "";
        
        const ageValidation = validateAge(formData.age || '');
        if (!ageValidation.isValid) errors.age = ageValidation.error || "";
        
        const genderValidation = validateRequired(formData.gender, "Jins");
        if (!genderValidation.isValid) errors.gender = genderValidation.error || "";
        
        const complaintsValidation = validateRequired(formData.complaints, "Shikoyatlar");
        if (!complaintsValidation.isValid) errors.complaints = complaintsValidation.error || "";
        
        // Validate vitals if provided
        if (vitals.bpSystolic) {
            const bpSysValidation = validateVitalSign(vitals.bpSystolic, 'bpSystolic');
            if (!bpSysValidation.isValid) errors.bpSystolic = bpSysValidation.error || "";
        }
        if (vitals.bpDiastolic) {
            const bpDiaValidation = validateVitalSign(vitals.bpDiastolic, 'bpDiastolic');
            if (!bpDiaValidation.isValid) errors.bpDiastolic = bpDiaValidation.error || "";
        }
        if (vitals.heartRate) {
            const hrValidation = validateVitalSign(vitals.heartRate, 'heartRate');
            if (!hrValidation.isValid) errors.heartRate = hrValidation.error || "";
        }
        if (vitals.temperature) {
            const tempValidation = validateVitalSign(vitals.temperature, 'temperature');
            if (!tempValidation.isValid) errors.temperature = tempValidation.error || "";
        }
        if (vitals.spO2) {
            const spo2Validation = validateVitalSign(vitals.spO2, 'spO2');
            if (!spo2Validation.isValid) errors.spO2 = spo2Validation.error || "";
        }
        if (vitals.respirationRate) {
            const respValidation = validateVitalSign(vitals.respirationRate, 'respirationRate');
            if (!respValidation.isValid) errors.respirationRate = respValidation.error || "";
        }
        
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        
        // Construct Objective Data String from Vitals
        const objectiveString = `
            Arterial Bosim: ${vitals.bpSystolic || '-'}/${vitals.bpDiastolic || '-'} mm.Hg
            Yurak Urishi (Puls): ${vitals.heartRate || '-'} zarba/daq
            Tana Harorati: ${vitals.temperature || '-'} °C
            Saturatsiya (SpO2): ${vitals.spO2 || '-'} %
            Nafas Soni: ${vitals.respirationRate || '-'} ta/daq
        `.trim();

        let attachmentData: PatientData['attachments'] = [];
        if (attachments.length > 0) {
            try {
                attachmentData = await Promise.all(
                    attachments.map(file => new Promise<{ name: string; base64Data: string; mimeType: string }>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const base64Data = (event.target?.result as string).split(',')[1];
                                resolve({ name: file.name, base64Data, mimeType: file.type });
                            } catch (error) {
                                reject(handleError(error, 'File reading'));
                            }
                        };
                        reader.onerror = () => reject(new Error(`Faylni o'qib bo'lmadi: ${file.name}`));
                        reader.readAsDataURL(file);
                    }))
                );
            } catch (error) {
                const appError = handleError(error, 'File upload');
                setFormErrors({ attachments: appError.message });
                return;
            }
        }

        const fullPatientData: PatientData = {
            firstName: formData.firstName || '',
            lastName: formData.lastName || '',
            age: formData.age || '',
            gender: formData.gender as 'male' | 'female' | 'other' | '',
            complaints: formData.complaints || '',
            history: formData.history || '',
            allergies: formData.allergies || undefined,
            currentMedications: formData.currentMedications || undefined,
            familyHistory: formData.familyHistory || undefined,
            additionalInfo: formData.additionalInfo || '',
            objectiveData: objectiveString,
            labResults: attachments.length > 0 ? "Laboratoriya va diagnostika natijalari fayl sifatida yuklandi." : undefined,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
        };

        const smartRes = validatePatientDataSmart(fullPatientData);
        if (!smartRes.valid && smartRes.missingCritical.length > 0) {
            setFormErrors(prev => ({ ...prev, _smart: smartRes.missingCritical.join('. ') }));
            return;
        }

        onSubmit(fullPatientData);
    };

    return (
        <div className="h-full flex flex-col animate-fade-in-up">
            
            {/* Main Form Content - Fits remaining height */}
            <form onSubmit={handleSubmit} className="flex-grow flex flex-col min-h-0">
                
                {/* Header & Submit Button */}
                <div className="flex-shrink-0 flex justify-between items-center mb-4 px-1">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Yangi Klinik Holat</h2>
                        <p className="text-xs text-text-secondary">Bemor ma'lumotlarini to'liq kiriting</p>
                    </div>
                    <button 
                        type="submit" 
                        disabled={isAnalyzing} 
                        className="shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm py-2.5 px-6 rounded-xl transform transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-blue-500/30 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                            <>
                                <SpinnerIcon className="w-4 h-4 text-white/90" />
                                <span>Tahlil...</span>
                            </>
                        ) : (
                            <>
                                <span>Tahlilni Boshlash</span>
                                <ChevronRightIcon className="w-4 h-4 opacity-80" />
                            </>
                        )}
                    </button>
                </div>

                {/* Aqlli maslahat / ogohlantirish */}
                {(smartMessage || formErrors._smart) && (
                    <div className={`flex-shrink-0 mb-3 px-3 py-2 rounded-xl text-xs font-medium ${formErrors._smart ? 'bg-red-100 border border-red-300 text-red-800' : 'bg-blue-100 border border-blue-300 text-blue-900'}`}>
                        {formErrors._smart ? formErrors._smart : smartMessage}
                    </div>
                )}

                <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0"> 
                    
                    {/* LEFT COLUMN: Demographics & Other Info (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col gap-3 h-full overflow-hidden">
                        {/* Demographics */}
                        <div className="glass-panel p-3 space-y-2 flex-shrink-0">
                            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px]">1</span>
                                Pasport
                            </h3>
                            <div>
                                <Input id="firstName" label={t('data_input_patient_name')} type="text" value={formData.firstName || ''} onChange={e => handleChange('firstName', e.target.value)} required placeholder="Ism" />
                                {formErrors.firstName && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{formErrors.firstName}</p>}
                            </div>
                            <div>
                                <Input id="lastName" label={t('data_input_patient_lastname')} type="text" value={formData.lastName || ''} onChange={e => handleChange('lastName', e.target.value)} required placeholder="Familiya" />
                                {formErrors.lastName && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{formErrors.lastName}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Input id="age" label={t('data_input_age')} type="number" value={formData.age || ''} onChange={e => handleChange('age', e.target.value)} required placeholder="Yosh" min="0" max="150" />
                                    {formErrors.age && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{formErrors.age}</p>}
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="gender" className="text-[10px] font-bold text-slate-700 uppercase tracking-wide ml-1 mb-0.5">{t('data_input_gender')}</label>
                                    <select id="gender" value={formData.gender || ''} onChange={e => handleChange('gender', e.target.value)} required className={`block w-full text-xs common-input py-1.5 px-2 bg-white/60 focus:bg-white border-none rounded-lg ${formErrors.gender ? 'ring-1 ring-red-500' : ''}`}>
                                        <option value="">...</option>
                                        <option value="male">Erkak</option>
                                        <option value="female">Ayol</option>
                                    </select>
                                    {formErrors.gender && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{formErrors.gender}</p>}
                                </div>
                            </div>
                        </div>
                        
                        {/* Allergiya va dori-darmonlar (xavfsizlik uchun muhim) */}
                        <div className="glass-panel p-3 space-y-2 flex-shrink-0">
                            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 text-[10px]">!</span>
                                Xavfsizlik
                            </h3>
                            <div>
                                <Input id="allergies" label={t('data_input_allergies')} type="text" value={formData.allergies || ''} onChange={e => handleChange('allergies', e.target.value)} placeholder="Allergiya (yo'q bo'lsa «Yo'q» yozing)" />
                            </div>
                            <div>
                                <Input id="currentMedications" label={t('data_input_current_medications')} type="text" value={formData.currentMedications || ''} onChange={e => handleChange('currentMedications', e.target.value)} placeholder="Joriy dori-darmonlar" />
                            </div>
                        </div>

                        {/* Other Information (Replaces old File Upload) */}
                        <div className="glass-panel p-3 flex-grow flex flex-col min-h-0">
                             <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 text-[10px]">4</span>
                                Boshqa ma'lumotlar
                            </h3>
                            <Textarea 
                                id="additionalInfo" 
                                label="Qo'shimcha izoh" 
                                placeholder="Allergiya, oilaviy muhit va boshqalar..."
                                value={formData.additionalInfo || ''} 
                                onChange={e => handleChange('additionalInfo', e.target.value)} 
                                className="flex-grow"
                            />
                        </div>
                    </div>

                    {/* MIDDLE COLUMN: Clinical Data & Vitals (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-3 h-full overflow-hidden">
                        <div className="glass-panel p-3 flex-grow flex flex-col min-h-0">
                            <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-800 text-[10px] font-bold">2</div>
                                <h3 className="text-xs font-bold text-slate-800">Klinik Ma'lumotlar</h3>
                            </div>

                            <div className="flex-grow flex flex-col gap-2 min-h-0">
                                <div className="flex-grow flex flex-col">
                                    <Textarea 
                                        id="complaints" 
                                        label={t('data_input_complaints_label')} 
                                        placeholder="Shikoyatlar..."
                                        value={formData.complaints || ''} 
                                        onChange={e => handleChange('complaints', e.target.value)} 
                                        required 
                                        className="flex-grow"
                                    />
                                    {formErrors.complaints && <p className="text-[10px] text-red-500 mt-0.5 ml-1">{formErrors.complaints}</p>}
                                </div>
                                <Textarea 
                                    id="history" 
                                    label={t('data_input_history_label')} 
                                    placeholder="Anamnez..." 
                                    value={formData.history || ''} 
                                    onChange={e => handleChange('history', e.target.value)} 
                                    className="flex-grow"
                                />
                            </div>
                        </div>

                        {/* Structured Vitals (Replaces old Objective Data Textarea) */}
                        <div className="glass-panel p-3 flex-shrink-0">
                            <h3 className="text-xs font-bold text-slate-800 mb-2">Ob'ektiv Ko'rik (Vital Ko'rsatkichlar)</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <VitalInput id="vital-bp-systolic" label="Qon Bosimi (Sys)" unit="mm" value={vitals.bpSystolic} onChange={e => handleVitalChange('bpSystolic', e.target.value)} />
                                <VitalInput id="vital-bp-diastolic" label="Qon Bosimi (Dia)" unit="mm" value={vitals.bpDiastolic} onChange={e => handleVitalChange('bpDiastolic', e.target.value)} />
                                <VitalInput id="vital-heart-rate" label="Puls" unit="bpm" value={vitals.heartRate} onChange={e => handleVitalChange('heartRate', e.target.value)} />
                                <VitalInput id="vital-temperature" label="Harorat" unit="°C" value={vitals.temperature} onChange={e => handleVitalChange('temperature', e.target.value)} />
                                <VitalInput id="vital-spo2" label="Saturatsiya" unit="%" value={vitals.spO2} onChange={e => handleVitalChange('spO2', e.target.value)} />
                                <VitalInput id="vital-respiration" label="Nafas Soni" unit="/min" value={vitals.respirationRate} onChange={e => handleVitalChange('respirationRate', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Diagnostics & Lab Uploads (4 cols) */}
                    <div className="lg:col-span-4 h-full overflow-hidden">
                         <div className="glass-panel p-3 h-full flex flex-col">
                            <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
                                <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-[10px] font-bold">3</div>
                                <h3 className="text-xs font-bold text-slate-800">Diagnostika va Laboratoriya</h3>
                            </div>
                            
                            <div 
                                onClick={() => fileInputRef.current?.click()} 
                                className="flex-grow border-2 border-dashed border-teal-200 bg-teal-50/30 rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-all group min-h-0 relative"
                            >
                                <UploadCloudIcon className="h-10 w-10 text-teal-400 mb-2 group-hover:scale-110 transition-transform"/>
                                <p className="text-sm font-bold text-teal-700 text-center">Fayllarni yuklash</p>
                                <p className="text-[10px] text-teal-600/70 text-center mt-1 px-4">
                                    Tahlil natijalari, Rentgen, EKG, MRT xulosalari (JPG, PDF, DOCX, XLSX)
                                </p>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" />
                            </div>

                            {/* File List */}
                            <div className="mt-3 flex-shrink-0 max-h-[150px] overflow-y-auto custom-scrollbar space-y-1">
                                {attachments.map(file => (
                                    <div key={file.name} className="flex items-center justify-between bg-white/60 px-3 py-2 rounded-lg border border-slate-200 text-xs">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <DocumentTextIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <span className="truncate max-w-[150px] font-medium text-slate-700" title={file.name}>{file.name}</span>
                                            <span className="text-[9px] text-slate-400">({(file.size / 1024 / 1024).toFixed(2)}MB)</span>
                                        </div>
                                        <button onClick={(e) => {e.stopPropagation(); removeAttachment(file.name)}} className="text-slate-400 hover:text-red-500 font-bold p-1 rounded hover:bg-red-50 transition-colors" aria-label={`${file.name} faylini o'chirish`}>&times;</button>
                                    </div>
                                ))}
                                {Object.keys(fileErrors).length > 0 && (
                                    <div className="space-y-1">
                                        {Object.entries(fileErrors).map(([fileName, error]) => (
                                            <div key={fileName} className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded border border-red-200">
                                                <strong>{fileName}:</strong> {error}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {attachments.length === 0 && Object.keys(fileErrors).length === 0 && (
                                    <p className="text-[10px] text-center text-slate-400 italic py-2">Hozircha fayllar yuklanmadi</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default DataInputForm;
