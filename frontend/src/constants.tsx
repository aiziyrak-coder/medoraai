
import React from 'react';
import { AIModel } from './constants/specialists';

// --- Icons ---

// Brand Icons
const GeminiLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.71429 13.0612L12 19.347L18.2857 13.0612L12 6.77551L5.71429 13.0612Z" fill="url(#paint0_linear_gemini)"/><path d="M12 6.77551L5.71429 13.0612L12 19.347L18.2857 13.0612L12 6.77551ZM4 13.0612L12 21L20 13.0612L12 5L4 13.0612Z" fill="url(#paint1_linear_gemini)"/><defs><linearGradient id="paint0_linear_gemini" x1="12" y1="6.77551" x2="12" y2="19.347" gradientUnits="userSpaceOnUse"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#3b82f6"/></linearGradient><linearGradient id="paint1_linear_gemini" x1="12" y1="5" x2="12" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#93c5fd"/><stop offset="1" stopColor="#60a5fa"/></linearGradient></defs></svg>
);
const ClaudeLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" transform="translate(4 4)" /></svg>
);
const GptLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C6.75329 21.5 2.5 17.2467 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z" stroke="currentColor" strokeWidth="1.5" /><path d="M12 17.5V14.5M12 14.5L8.5 12.5L12 10.5L15.5 12.5L12 14.5ZM12 10.5V6.5M8.5 12.5L7 11.5M15.5 12.5L17 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const LlamaLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 14L9 5L12 14M9 5L6.5 5M9 5L11.5 5M4 21L5.19559 18.4088C5.64368 17.4329 6.64393 16.8053 7.73139 16.9642L12 17.6667M18 14L15 5L12 14M15 5L17.5 5M15 5L12.5 5M20 21L18.8044 18.4088C18.3563 17.4329 17.3561 16.8053 16.2686 16.9642L12 17.6667M12 14L12 17.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const GrokLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V15M15 18H9M12 15L4 7M12 15L20 7M8 3H16M4 7H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const OrkestratorLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.6231 10.0945C19.8009 10.6358 19.888 11.2096 19.888 11.7999C19.888 16.2339 16.3219 19.8879 11.9769 19.8879C9.76648 19.8879 7.78853 18.914 6.42512 17.4043M4.26491 14.1953C4.09436 13.6331 4 13.0401 4 12.4217C4 8.03153 7.50275 4.42173 11.7954 4.42173C13.9351 4.42173 15.8569 5.34444 17.2143 6.78531" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14.5 9.5L9.5 14.5M9.5 9.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);

// Generic Medical Icons
const LungsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
);
const StomachIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>
);
const KidneyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const ScalpelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
);
const VirusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
);
const BloodIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l1.5 1.5.75-.75V8.758l2.276-.61a3 3 0 10-3.675-3.675l-.61 2.277H12l-.75.75 1.5 1.5M15 11.25l-8.47 8.47c-.34.34-.8.53-1.28.53s-.94.19-1.28.53l-.97.97-.75-.75.97-.97c.34-.34.53-.8.53-1.28s.19-.94.53-1.28L12.75 9M15 11.25L12.75 9" /></svg>
);
const BoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
);
const PillIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
);
const BrainIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
);
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const ChildIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
);
const DnaIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);
const MicroscopeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H9m1.5 0c.966 0 1.75-.784 1.75-1.75s-.784-1.75-1.75-1.75-1.75.784-1.75 1.75.784 1.75 1.75 1.75z" /></svg>
);
const UserGroupIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.96a3 3 0 00-4.682 2.72 8.986 8.986 0 003.74.477m-4.682-2.72a3 3 0 013.74-2.475M12 17.25a3 3 0 013.74-2.475m-3.74 2.475a3 3 0 003.74-2.475M9 9.75a3 3 0 116 0 3 3 0 01-6 0z" /></svg>
);
const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286z" />
    </svg>
);

const commonStyle = { bg: 'bg-slate-100', border: 'border-slate-200' };

export const AI_SPECIALISTS = {
    // Core AI Models
    [AIModel.GEMINI]: { name: 'Cardiologist AI (Gemini)', specialty: 'Cardiology', Logo: GeminiLogo, text: 'text-blue-600', ...commonStyle },
    [AIModel.CLAUDE]: { name: 'Neurologist AI (Claude)', specialty: 'Neurology', Logo: ClaudeLogo, text: 'text-orange-600', ...commonStyle },
    [AIModel.GPT]: { name: 'Radiologist AI (GPT)', specialty: 'Radiology', Logo: GptLogo, text: 'text-teal-600', ...commonStyle },
    [AIModel.LLAMA]: { name: 'Oncologist AI (Llama)', specialty: 'Oncology', Logo: LlamaLogo, text: 'text-rose-600', ...commonStyle },
    [AIModel.GROK]: { name: 'Endocrinologist AI (Grok)', specialty: 'Endocrinology', Logo: GrokLogo, text: 'text-indigo-600', ...commonStyle },
    
    // Expanded List with Generic Icons Mapping
    [AIModel.ALLERGIST]: { name: 'Allergist', specialty: 'Allergy & Immunology', Logo: LungsIcon, text: 'text-pink-500', ...commonStyle },
    [AIModel.ANESTHESIOLOGIST]: { name: 'Anesthesiologist', specialty: 'Anesthesiology', Logo: PillIcon, text: 'text-gray-500', ...commonStyle },
    [AIModel.DERMATOLOGIST]: { name: 'Dermatologist', specialty: 'Dermatology', Logo: MicroscopeIcon, text: 'text-amber-600', ...commonStyle },
    [AIModel.EMERGENCY]: { name: 'Emergency Physician', specialty: 'Emergency Medicine', Logo: ShieldCheckIcon, text: 'text-red-600', ...commonStyle },
    [AIModel.FAMILY_MEDICINE]: { name: 'Family Physician', specialty: 'Family Medicine', Logo: UserGroupIcon, text: 'text-green-600', ...commonStyle },
    [AIModel.GASTRO]: { name: 'Gastroenterologist', specialty: 'Gastroenterology', Logo: StomachIcon, text: 'text-amber-500', ...commonStyle },
    [AIModel.GENETICIST]: { name: 'Medical Geneticist', specialty: 'Medical Genetics', Logo: DnaIcon, text: 'text-purple-500', ...commonStyle },
    [AIModel.GERIATRICIAN]: { name: 'Geriatrician', specialty: 'Geriatrics', Logo: UserGroupIcon, text: 'text-slate-600', ...commonStyle },
    [AIModel.HEMATOLOGIST]: { name: 'Hematologist', specialty: 'Hematology', Logo: BloodIcon, text: 'text-rose-700', ...commonStyle },
    [AIModel.INFECTIOUS]: { name: 'Infectious Disease Specialist', specialty: 'Infectious Disease', Logo: VirusIcon, text: 'text-green-600', ...commonStyle },
    [AIModel.INTERNAL_MEDICINE]: { name: 'Internist', specialty: 'Internal Medicine', Logo: UserGroupIcon, text: 'text-blue-500', ...commonStyle },
    [AIModel.NEPHROLOGIST]: { name: 'Nephrologist', specialty: 'Nephrology', Logo: KidneyIcon, text: 'text-indigo-500', ...commonStyle },
    [AIModel.OBGYN]: { name: 'Obstetrician-Gynecologist', specialty: 'OB-GYN', Logo: ChildIcon, text: 'text-pink-600', ...commonStyle },
    [AIModel.OPHTHALMOLOGIST]: { name: 'Ophthalmologist', specialty: 'Ophthalmology', Logo: EyeIcon, text: 'text-cyan-600', ...commonStyle },
    [AIModel.ORTHOPEDIC]: { name: 'Orthopedic Surgeon', specialty: 'Orthopedics', Logo: BoneIcon, text: 'text-slate-700', ...commonStyle },
    [AIModel.OTOLARYNGOLOGIST]: { name: 'ENT Specialist', specialty: 'Otolaryngology', Logo: UserGroupIcon, text: 'text-orange-500', ...commonStyle },
    [AIModel.PATHOLOGIST]: { name: 'Pathologist', specialty: 'Pathology', Logo: MicroscopeIcon, text: 'text-violet-600', ...commonStyle },
    [AIModel.PEDIATRICIAN]: { name: 'Pediatrician', specialty: 'Pediatrics', Logo: ChildIcon, text: 'text-blue-400', ...commonStyle },
    [AIModel.PHARMACOLOGIST]: { name: 'Pharmacologist', specialty: 'Clinical Pharmacology', Logo: PillIcon, text: 'text-teal-700', ...commonStyle },
    [AIModel.PHYSIATRIST]: { name: 'Physiatrist', specialty: 'Physical Medicine', Logo: UserGroupIcon, text: 'text-lime-600', ...commonStyle },
    [AIModel.PLASTIC_SURGEON]: { name: 'Plastic Surgeon', specialty: 'Plastic Surgery', Logo: ScalpelIcon, text: 'text-pink-400', ...commonStyle },
    [AIModel.PSYCHIATRIST]: { name: 'Psychiatrist', specialty: 'Psychiatry', Logo: BrainIcon, text: 'text-violet-600', ...commonStyle },
    [AIModel.PULMONOLOGIST]: { name: 'Pulmonologist', specialty: 'Pulmonology', Logo: LungsIcon, text: 'text-cyan-500', ...commonStyle },
    [AIModel.RHEUMATOLOGIST]: { name: 'Rheumatologist', specialty: 'Rheumatology', Logo: BoneIcon, text: 'text-purple-600', ...commonStyle },
    [AIModel.SURGEON]: { name: 'General Surgeon', specialty: 'General Surgery', Logo: ScalpelIcon, text: 'text-red-500', ...commonStyle },
    [AIModel.UROLOGIST]: { name: 'Urologist', specialty: 'Urology', Logo: KidneyIcon, text: 'text-yellow-600', ...commonStyle },
    
    // Niche
    [AIModel.NEONATOLOGIST]: { name: 'Neonatologist', specialty: 'Neonatology', Logo: ChildIcon, text: 'text-sky-300', ...commonStyle },
    [AIModel.NEUROSURGEON]: { name: 'Neurosurgeon', specialty: 'Neurosurgery', Logo: BrainIcon, text: 'text-zinc-600', ...commonStyle },
    [AIModel.CARDIO_SURGEON]: { name: 'Cardiothoracic Surgeon', specialty: 'Cardiothoracic Surgery', Logo: ScalpelIcon, text: 'text-red-700', ...commonStyle },
    [AIModel.VASCULAR_SURGEON]: { name: 'Vascular Surgeon', specialty: 'Vascular Surgery', Logo: BloodIcon, text: 'text-red-400', ...commonStyle },
    [AIModel.TRAUMATOLOGIST]: { name: 'Traumatologist', specialty: 'Traumatology', Logo: BoneIcon, text: 'text-orange-700', ...commonStyle },
    [AIModel.TOXICOLOGIST]: { name: 'Toxicologist', specialty: 'Toxicology', Logo: ShieldCheckIcon, text: 'text-lime-500', ...commonStyle },
    [AIModel.SPORTS_MEDICINE]: { name: 'Sports Medicine Specialist', specialty: 'Sports Medicine', Logo: UserGroupIcon, text: 'text-blue-500', ...commonStyle },
    [AIModel.SLEEP_MEDICINE]: { name: 'Sleep Medicine Specialist', specialty: 'Sleep Medicine', Logo: LungsIcon, text: 'text-indigo-400', ...commonStyle },
    [AIModel.PAIN_MANAGEMENT]: { name: 'Pain Management Specialist', specialty: 'Pain Medicine', Logo: PillIcon, text: 'text-red-300', ...commonStyle },
    [AIModel.NUTRITIONIST]: { name: 'Nutritionist', specialty: 'Nutrition', Logo: StomachIcon, text: 'text-green-500', ...commonStyle },
    [AIModel.IMMUNOLOGIST]: { name: 'Immunologist', specialty: 'Immunology', Logo: ShieldCheckIcon, text: 'text-amber-400', ...commonStyle },
    [AIModel.HEPATOLOGIST]: { name: 'Hepatologist', specialty: 'Hepatology', Logo: StomachIcon, text: 'text-yellow-600', ...commonStyle },
    [AIModel.EPIDEMIOLOGIST]: { name: 'Epidemiologist', specialty: 'Epidemiology', Logo: VirusIcon, text: 'text-slate-500', ...commonStyle },
    [AIModel.DENTIST]: { name: 'Dentist', specialty: 'Dentistry', Logo: BoneIcon, text: 'text-blue-200', ...commonStyle },
    [AIModel.MAXILLOFACIAL]: { name: 'Oral Surgeon', specialty: 'Oral & Maxillofacial', Logo: ScalpelIcon, text: 'text-stone-500', ...commonStyle },

    // New Additions
    [AIModel.PROCTOLOGIST]: { name: 'Proctologist', specialty: 'Proctology', Logo: StomachIcon, text: 'text-brown-500', ...commonStyle },
    [AIModel.MAMMOLOGIST]: { name: 'Mammologist', specialty: 'Mammology', Logo: MicroscopeIcon, text: 'text-pink-400', ...commonStyle },
    [AIModel.PHTHISIATRICIAN]: { name: 'Phthisiatrician', specialty: 'Phthisiology', Logo: LungsIcon, text: 'text-gray-600', ...commonStyle },
    [AIModel.NARCOLOGIST]: { name: 'Narcologist', specialty: 'Narcology', Logo: PillIcon, text: 'text-purple-700', ...commonStyle },
    [AIModel.PSYCHOTHERAPIST]: { name: 'Psychotherapist', specialty: 'Psychotherapy', Logo: BrainIcon, text: 'text-teal-600', ...commonStyle },
    [AIModel.SEXOLOGIST]: { name: 'Sexologist', specialty: 'Sexology', Logo: UserGroupIcon, text: 'text-rose-400', ...commonStyle },
    [AIModel.VERTEBROLOGIST]: { name: 'Vertebrologist', specialty: 'Vertebrology', Logo: BoneIcon, text: 'text-emerald-700', ...commonStyle },

    [AIModel.SYSTEM]: { name: 'Konsilium Chair (Orchestrator)', specialty: 'Moderator', Logo: OrkestratorLogo, text: 'text-slate-700', bg: 'bg-slate-200', border: 'border-slate-300' },
};
