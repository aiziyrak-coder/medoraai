
export enum AIModel {
  // --- Asosiy mutaxassislar (tibbiy nom; AI nomi UI da ko'rsatilmaydi) ---
  GEMINI = 'Cardiologist',
  CLAUDE = 'Neurologist',
  GPT = 'Radiologist',
  LLAMA = 'Oncologist',
  GROK = 'Endocrinologist',
  
  // --- Expanded Specialties ---
  ALLERGIST = 'Allergist',
  ANESTHESIOLOGIST = 'Anesthesiology',
  DERMATOLOGIST = 'Dermatologist',
  EMERGENCY = 'Emergency',
  FAMILY_MEDICINE = 'Family Medicine',
  GASTRO = 'Gastroenterologist',
  GENETICIST = 'Geneticist',
  GERIATRICIAN = 'Geriatrician',
  HEMATOLOGIST = 'Hematologist',
  INFECTIOUS = 'Infectious',
  INTERNAL_MEDICINE = 'Internal Medicine',
  NEPHROLOGIST = 'Nephrologist',
  OBGYN = 'ObGyn',
  OPHTHALMOLOGIST = 'Ophthalmologist',
  ORTHOPEDIC = 'Orthopedic',
  OTOLARYNGOLOGIST = 'Otolaryngologist',
  PATHOLOGIST = 'Pathologist',
  PEDIATRICIAN = 'Pediatrician',
  PHARMACOLOGIST = 'Pharmacologist',
  PHYSIATRIST = 'Physiatrist',
  PLASTIC_SURGEON = 'Plastic Surgeon',
  PSYCHIATRIST = 'Psychiatrist',
  PULMONOLOGIST = 'Pulmonologist',
  RHEUMATOLOGIST = 'Rheumatologist',
  SURGEON = 'Surgeon',
  UROLOGIST = 'Urologist',
  
  // --- Niche / Specialized ---
  NEONATOLOGIST = 'Neonatologist',
  NEUROSURGEON = 'Neurosurgeon',
  CARDIO_SURGEON = 'Cardiothoracic Surgeon',
  VASCULAR_SURGEON = 'Vascular Surgeon',
  TRAUMATOLOGIST = 'Traumatologist',
  TOXICOLOGIST = 'Toxicologist',
  SPORTS_MEDICINE = 'Sports Medicine',
  SLEEP_MEDICINE = 'Sleep Medicine',
  PAIN_MANAGEMENT = 'Pain Management',
  NUTRITIONIST = 'Nutritionist',
  IMMUNOLOGIST = 'Immunologist',
  HEPATOLOGIST = 'Hepatologist',
  EPIDEMIOLOGIST = 'Epidemiologist',
  DENTIST = 'Dentist',
  MAXILLOFACIAL = 'Maxillofacial',
  
  // --- New Additions (Requests) ---
  PROCTOLOGIST = 'Proctologist',
  MAMMOLOGIST = 'Mammologist',
  PHTHISIATRICIAN = 'Phthisiatrician',
  NARCOLOGIST = 'Narcologist',
  PSYCHOTHERAPIST = 'Psychotherapist',
  SEXOLOGIST = 'Sexologist',
  VERTEBROLOGIST = 'Vertebrologist',

  // --- Qo'shimcha mutaxassislar ---
  ANDROLOGIST = 'Andrologist',
  ANGIOLOGIST = 'Angiologist',
  PALLIATIVE = 'Palliative Care',
  TRANSFUSIOLOGIST = 'Transfusiologist',
  MICROBIOLOGIST = 'Microbiologist',
  OCCUPATIONAL_MEDICINE = 'Occupational Medicine',
  REPRODUCTIVE_MEDICINE = 'Reproductive Medicine',
  CLINICAL_BIOCHEMIST = 'Clinical Biochemist',
  PHYSICAL_THERAPIST = 'Physical Therapist',
  LOGOPEDIST = 'Speech Therapist',
  
  // --- System ---
  SYSTEM = 'Orchestrator'
}