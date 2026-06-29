
import { isPlaceholderSectionIntro } from './constants/citationRules';
import { AIModel } from './constants/specialists';

// Original types - some modified for new features
export { AIModel };

export type AppView =
  | 'dashboard'
  | 'registrar'
  | 'new_analysis'
  | 'clarification'
  | 'team_recommendation'
  | 'live_analysis'
  | 'history'
  | 'view_history_item'
  | 'case_library'
  | 'uzi_utt'
  | 'prescription_audit'
  | 'tools'
  | 'prescription'
  | 'tumor_board'
  | 'longitudinal_view'
  | 'subscription'
  | 'population'
  | 'primary_care';

/** Bemor marshrutlash: mutaxassis, tekshiruv rejasi, statsionar */
export interface PatientRouting {
  recommendedSpecialists?: Array<{ specialty: string; reason: string; urgency?: 'urgent' | 'routine' }>;
  examPlan?: string[];
  referrals?: Array<{ specialty: string; reason: string; urgency?: 'urgent' | 'routine' }>;
  disposition?: 'outpatient' | 'observation' | 'inpatient' | 'emergency';
  dispositionReason?: string;
  followUpTimeline?: string;
  hospitalizationIndicated?: boolean;
  hospitalizationReason?: string;
}

export interface RiskFactor {
  factor: string;
  severity?: 'high' | 'medium' | 'low';
  mitigation?: string;
}

export interface SeverityAssessment {
  level: 'critical' | 'urgent' | 'moderate' | 'low';
  score?: number;
  rationale?: string;
  redFlags?: string[];
}

export type UserRole = 'clinic' | 'staff' | 'regional_stats';

export type SubscriptionStatus = 'active' | 'inactive' | 'pending';

/** Obuna rejasi: bazaviy narx USD bo'lsa, `price_monthly_uzs` — kurs bo'yicha yaxlitlangan so'm */
export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  plan_type?: 'clinic' | 'doctor';
  description?: string;
  price_monthly: number;
  price_monthly_uzs?: number;
  price_currency?: string;
  duration_days: number;
  features: string[];
  is_trial: boolean;
  trial_days: number;
  max_analyses_per_month?: number | null;
  sort_order: number;
}

/** Joriy obuna ma'lumotlari */
export interface MySubscription {
  subscription_status: SubscriptionStatus;
  subscription_expiry: string | null;
  trial_ends_at: string | null;
  has_active_subscription: boolean;
  plan: SubscriptionPlan | null;
}

export interface User {
  phone: string;
  name: string;
  password?: string;
  role: UserRole;
  specialties?: string[];
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiry?: string;
  subscriptionPlan?: SubscriptionPlan | null;
  trialEndsAt?: string | null;
  /** Backend UserSerializer: has_active_subscription */
  hasActiveSubscription?: boolean;
  isStaff?: boolean;
  isSuperuser?: boolean;
  isClinicGroupAdmin?: boolean;
  clinicGroupId?: number;
  clinicGroupName?: string;
  scopedRegionId?: string;
}

export interface PatientQueueItem {
    id: string;
    // Split name for better structure
    firstName: string; 
    lastName: string;
    age: string;
    address: string;
    // Computed display name
    patientName: string; 
    arrivalTime: string;
    status: 'waiting' | 'in-progress' | 'completed' | 'hold';
    complaints?: string;
    ticketNumber: number;
}

export interface DetectedMedication {
  name:string;
  dosage: string;
}

export interface AnalysisRecord {
  id: string;
  patientId: string; // Used to link records for longitudinal view
  date: string;
  patientData: PatientData;
  debateHistory: ChatMessage[];
  finalReport: FinalReport;
  followUpHistory: { question: string; answer: string }[];
  detectedMedications?: DetectedMedication[];
  selectedSpecialists?: AIModel[];
}

export type DiagnosisFeedback = 'more-likely' | 'less-likely' | 'needs-review' | 'injected-hypothesis';

export interface SymptomTimelineEvent {
    date: string;
    symptom: string;
    severity: number; // 0-10 scale
    notes?: string;
}

export interface PatientData {
  // --- Basic Info ---
  /** Pasport seriya raqami — bemorning doimiy ID raqami (masalan AB1234567) */
  registryNumber?: string;
  firstName: string;
  lastName: string;
  /** Otasining ismi (patronimik) */
  fatherName?: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  phone?: string;
  address?: string;
  regionId?: string;
  districtId?: string;
  regionName?: string;
  districtName?: string;
  // --- Clinical Info ---
  complaints: string;
  history?: string;
  objectiveData?: string;
  labResults?: string; // Unstructured text
  allergies?: string;
  currentMedications?: string;
  familyHistory?: string;
  additionalInfo?: string;
  // --- Structured & Advanced Data ---
  structuredLabResults?: Record<string, { value: string; unit: string; trend?: 'up' | 'down' | 'stable' }[]>;
  pharmacogenomicsReport?: string; // New field for genomic data
  symptomTimeline?: SymptomTimelineEvent[]; // New field for symptom tracking
  mentalHealthScores?: { // New field for screeners
      phq9?: number;
      gad7?: number;
  };
  attachments?: {
    name: string;
    base64Data: string;
    mimeType: string;
  }[];
  userDiagnosisFeedback?: Record<string, DiagnosisFeedback>;
  /** Avvalgi tahlillar bo'yicha AI uchun qisqa dinamika (ichki, konsilium promptiga qo'shiladi) */
  longitudinalClinicalNotes?: string;
  /** Mintaqaviy kontekst (epidemiologiya, mavsumiy kasalliklar) */
  regionalContext?: string;
  /** Oldingi mutaxassislar munozarasi xulosasi */
  specialistDebateSummary?: string;
  /** Konsilium oldidan differensial tashxislar (matn) */
  differentialDiagnosesNotes?: string;
  /** Faqat shikoyat bilan davom etish (klinik minimum ogohlantirilgan) */
  allowIncompleteClinical?: boolean;
  /** Klinika guruhi ichidagi UZI/UTT/Rengen AI xulosasi (konsilium promptiga) */
  imagingAnalysisSummary?: string;
  /** Strukturali tasvir (ecg, ultrasound, xray, ...) */
  imagingStructured?: Record<string, Record<string, unknown>>;
  /** Konsiliumda so'nggi tasvir tahlillarini hisobga olish */
  includePriorImaging?: boolean;
  /** Antropometriya */
  weightKg?: string;
  heightCm?: string;
  /** Tana massasi indeksi (avtomatik hisoblanadi) */
  bmi?: string;
}

/** Bazada saqlangan UZI/UTT/Rengen tahlili */
export interface ImagingStudyRecord {
  id: number;
  patient: number;
  modality: 'auto' | 'ultrasound' | 'xray' | 'mixed';
  report: UziUttReport;
  summary_text: string;
  imaging_structured: Record<string, Record<string, unknown>>;
  physician?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  author: AIModel;
  content: string;
  isThinking?: boolean;
  rationale?: string;
  isUserIntervention?: boolean;
  isSystemMessage?: boolean;
  evidenceLevel?: 'High' | 'Moderate' | 'Low' | 'Anecdotal'; // New field for evidence grading
}

export interface Diagnosis {
  name: string;
  probability: number;
  justification: string;
  evidenceLevel: string;
  icd10?: string;
  /** MKB-10 bo'yicha rasmiy tashxis nomi */
  icd10Description?: string;
  /** 1 = asosiy, 2+ = differensial */
  diagnosisRank?: number;
  isUserInjected?: boolean;
  // NEW: Deep reasoning fields
  reasoningChain?: string[]; // Step-by-step logic
  uzbekProtocolMatch?: string; // e.g., "SSV Protokol No. 42 ga mos"
}

// --- ENHANCED FINAL REPORT ---

export interface CriticalFinding {
  finding: string;
  implication: string;
  urgency: 'High' | 'Medium';
}

export interface FollowUpTask {
  task: string;
  timeline: string;
  responsible: 'Clinician' | 'Patient';
}

export interface PrognosisReport {
  shortTermPrognosis: string;
  longTermPrognosis: string;
  keyFactors: string[];
  confidenceScore: number; // 0-1
}

export interface Referral {
  specialty: string;
  reason: string;
  urgency: 'Urgent' | 'Routine';
}

export interface MatchedClinicalTrial {
    trialId: string;
    title: string;
    url: string;
    relevance: string;
}

export interface LifestylePlan {
    diet: string[];
    exercise: string[];
    other?: string[];
}

export interface AdverseEventRisk {
    drug: string;
    risk: string;
    probability: number; // 0-1
    management: string;
}

export interface RelatedResearch {
    title: string;
    url: string;
    /** Short evidence note: what exactly this source supports. */
    summary: string;
}

/** Xalq tabobati: dorivor o'simliklar (konservativ davolash/reabilitatsiyaga qo'shimcha ma'lumot). */
export interface FolkMedicineItem {
  plantName: string;
  plantPart?: string;
  preparationOrUsage?: string;
  traditionalContext?: string;
  precautions?: string;
}

export interface FolkMedicineSection {
  intro?: string;
  disclaimer?: string;
  items: FolkMedicineItem[];
}

/** Kasalliklarni oldini olish: to'g'ri ovqatlanish va profilaktika (alohida bo'lim). */
export interface IndividualDietPlan {
  diagnosis: string;
  allowedFoods: string[];
  restrictedFoods: string[];
  mealPlanNotes?: string;
}

export interface NutritionPreventionSection {
  intro?: string;
  dietaryGuidelines: string[];
  preventionMeasures: string[];
  disclaimer?: string;
  /** Tashxis bo'yicha individual parhez */
  individualDietByDiagnosis?: IndividualDietPlan[];
}

/** SSV protokoliga nisbatan amaliyotdagi kamchilik */
export interface ProtocolComplianceGap {
  gap: string;
  protocolReference?: string;
  severity: 'high' | 'medium' | 'low';
  consequences?: string;
  recommendedCorrection?: string;
}

/** Tibbiy yordam sifati audit */
export interface CareQualityAudit {
  overallScore?: number;
  summary?: string;
  errors: Array<{
    category: string;
    description: string;
    protocolReference?: string;
    impact?: string;
  }>;
  strengths: string[];
}

export interface ImagingModalityBlock {
  summary?: string;
  keyFindings?: string[];
  clinicalSignificance?: string;
  limitations?: string;
}

export interface ImagingInterpretation {
  ecg?: ImagingModalityBlock;
  ultrasound?: ImagingModalityBlock;
  xray?: ImagingModalityBlock;
  ct?: ImagingModalityBlock;
  mri?: ImagingModalityBlock;
  generalCorrelation?: string;
}


export interface FinalReport {
  criticalFinding?: CriticalFinding;
  consensusDiagnosis: Diagnosis[];
  rejectedHypotheses: {
    name:string;
    reason: string;
  }[];
  imageAnalysis?: {
    findings: string;
    correlation: string;
  };
  prognosisReport?: PrognosisReport;
  recommendedTests: string[];
  treatmentPlan: string[];
  medicationRecommendations: {
    name: string;
    dosage: string;
    frequency?: string; // kuniga 3 marta, 2 marta...
    timing?: string; // ovqatdan oldin, keyin, ovqat bilan
    duration?: string; // 5 kun, 7 kun, 14 kun
    instructions?: string; // qo'shimcha yo'riqnoma
    notes: string;
    localAvailability?: string; // e.g., "O'zbekistonda bor: Nimesil, Nise"
    priceEstimate?: string; // e.g., "~45,000 so'm"
    adverseEffects?: string[];
    contraindications?: string;
    monitoring?: string;
  }[];
  followUpPlan?: FollowUpTask[];
  referrals?: Referral[];
  unexpectedFindings: string;
  // --- New Feature Fields ---
  costEffectivenessNotes?: string;
  lifestylePlan?: LifestylePlan;
  matchedClinicalTrials?: MatchedClinicalTrial[];
  adverseEventRisks?: AdverseEventRisk[];
  simplifiedFamilyExplanation?: string;
  relatedResearch?: RelatedResearch[];
  uzbekistanLegislativeNote?: string; // Specific legal context
  /** Alohida: xalq tabobati va dorivor o'simliklar (rasmiy dori-darmonlar o'rnini bosmasin). */
  folkMedicine?: FolkMedicineSection;
  /** Alohida: to'g'ri ovqatlanish va kasalliklarni oldini olish (profilaktika). */
  nutritionPrevention?: NutritionPreventionSection;
  /** SSV protokoliga nisbatan kamchiliklar va oqibatlar */
  protocolComplianceGaps?: ProtocolComplianceGap[];
  /** Karta bo'yicha tibbiy yordam sifati */
  careQualityAudit?: CareQualityAudit;
  /** EKG / UZI / rengen tahlili */
  imagingInterpretation?: ImagingInterpretation;
  /** Bemor marshrutlash moduli */
  patientRouting?: PatientRouting;
  /** Xavf omillari */
  riskFactors?: RiskFactor[];
  /** Holat og'irligi / triaj */
  severityAssessment?: SeverityAssessment;
  /** Deterministik klinik qizil bayroqlar (server qoidalari) */
  clinicalRedFlags?: ClinicalRedFlag[];
  /** Farmakologiya ogohlantirishlari */
  pharmacologyWarnings?: string[];
}

export interface ClinicalRedFlag {
  severity: string;
  code: string;
  message: string;
  action: string;
}

/** Returns reasoningChain as a string array (handles API returning string or non-array). */
export function getReasoningChainArray(d: { reasoningChain?: unknown }): string[] {
  const rc = d?.reasoningChain;
  if (Array.isArray(rc)) return rc.filter((s): s is string => typeof s === 'string');
  if (typeof rc === 'string' && rc.trim()) return [rc.trim()];
  return [];
}

/** API snake_case / Gemini nomlarini birlashtiradi. */
export function normalizeFolkMedicine(raw: unknown): FolkMedicineSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const itemsRaw = o.items;
  const items: FolkMedicineItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const it of itemsRaw) {
      if (!it || typeof it !== 'object') continue;
      const r = it as Record<string, unknown>;
      const plantName = String(r.plantName ?? r.plant_name ?? '').trim();
      if (!plantName) continue;
      items.push({
        plantName,
        plantPart: String(r.plantPart ?? r.plant_part ?? '').trim() || undefined,
        preparationOrUsage: String(r.preparationOrUsage ?? r.preparation_or_usage ?? '').trim() || undefined,
        traditionalContext: String(r.traditionalContext ?? r.traditional_context ?? '').trim() || undefined,
        precautions: String(r.precautions ?? '').trim() || undefined,
      });
    }
  }
  const rawIntro = String(o.intro ?? '').trim();
  const intro = rawIntro && !isPlaceholderSectionIntro(rawIntro) ? rawIntro : undefined;
  const disclaimer = String(o.disclaimer ?? '').trim() || undefined;
  if (items.length === 0 && !intro && !disclaimer) return undefined;
  return { intro, disclaimer, items };
}

function _stringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/** nutrition_prevention / nutritionPrevention — ovqatlanish va profilaktika. */
export function normalizeNutritionPrevention(raw: unknown): NutritionPreventionSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const dietaryGuidelines = _stringList(o.dietaryGuidelines ?? o.dietary_guidelines);
  const preventionMeasures = _stringList(o.preventionMeasures ?? o.prevention_measures);
  const rawIntro = String(o.intro ?? '').trim();
  const intro = rawIntro && !isPlaceholderSectionIntro(rawIntro) ? rawIntro : undefined;
  const disclaimer = String(o.disclaimer ?? '').trim() || undefined;
  const individualRaw = o.individualDietByDiagnosis ?? o.individual_diet_by_diagnosis;
  const individualDietByDiagnosis: IndividualDietPlan[] = [];
  if (Array.isArray(individualRaw)) {
    for (const row of individualRaw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const diagnosis = String(r.diagnosis ?? '').trim();
      if (!diagnosis) continue;
      individualDietByDiagnosis.push({
        diagnosis,
        allowedFoods: _stringList(r.allowedFoods ?? r.allowed_foods),
        restrictedFoods: _stringList(r.restrictedFoods ?? r.restricted_foods),
        mealPlanNotes: String(r.mealPlanNotes ?? r.meal_plan_notes ?? '').trim() || undefined,
      });
    }
  }
  if (
    dietaryGuidelines.length === 0 &&
    preventionMeasures.length === 0 &&
    !intro &&
    !disclaimer &&
    individualDietByDiagnosis.length === 0
  ) {
    return undefined;
  }
  return {
    intro,
    dietaryGuidelines,
    preventionMeasures,
    disclaimer,
    ...(individualDietByDiagnosis.length ? { individualDietByDiagnosis } : {}),
  };
}

/** Ensures consensusDiagnosis is always an array of Diagnosis; normalizes API/Gemini shape.
 *  Probability kelayotgan qiymat ba'zan 0–1 oralig'ida (0.85) yoki 0–100 oralig'ida (85) bo'lishi mumkin.
 *  Foydalanuvchiga har doim FOIZ ko'rinishida ko'rsatish uchun:
 *    - agar 0 <= p <= 1 bo'lsa, 100 ga ko'paytiramiz (0.85 -> 85);
 *    - aks holda p ni o'zini qoldiramiz.
 *  Bir nechta tashxisda barcha foizlar > 0 bo'lsa va yig'indi 100% dan sezilarli farq qilsa,
 *  nisbatlar saqlangan holda 100% ga normallashtiriladi (shablon 60/25 emas, matematik muvozanat).
 */
export function normalizeConsensusDiagnosis(raw: unknown): Diagnosis[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.name || o.diagnosis || o.primary_diagnosis || o.primaryDiagnosis) {
      items = [raw];
    }
  }

  const mapped = items.map((item: Record<string, unknown>) => {
    const pRaw = Number(item?.probability ?? 0);
    const pNorm = Number.isFinite(pRaw)
      ? (pRaw >= 0 && pRaw <= 1 ? pRaw * 100 : pRaw)
      : 0;
    const icdRaw = item?.icd10 ?? item?.icd_10;
    const icdDescRaw = item?.icd10Description ?? item?.icd10_description;
    const rankRaw = item?.diagnosisRank ?? item?.diagnosis_rank;
    const rankNum = Number(rankRaw);
    return {
      name: String(item?.name ?? item?.diagnosis ?? item?.primary_diagnosis ?? item?.primaryDiagnosis ?? ''),
      probability: Math.max(0, Math.round(pNorm)),
      justification: String(
        item?.justification ?? item?.reason ?? item?.reasoningChain ?? item?.reasoning_chain ?? '',
      ),
      evidenceLevel: String(item?.evidenceLevel ?? 'Moderate'),
      ...(icdRaw ? { icd10: String(icdRaw).trim() } : {}),
      ...(icdDescRaw ? { icd10Description: String(icdDescRaw).trim() } : {}),
      ...(Number.isFinite(rankNum) && rankNum > 0 ? { diagnosisRank: rankNum } : {}),
      reasoningChain: Array.isArray(item?.reasoningChain) ? (item.reasoningChain as string[]) : (typeof item?.reasoningChain === 'string' ? [item.reasoningChain] : []),
      uzbekProtocolMatch: String(item?.uzbekProtocolMatch ?? item?.uzbek_protocol_match ?? ''),
    } as Diagnosis;
  });

  reconcileConsensusProbabilities(mapped);

  return mapped;
}

/**
 * Bir nechta differensial tashxis uchun: model bergan nisbiy foizlarni 100% ga moslashtiradi.
 * Bitta tashxis: faqat 0–100 oralig'ida qisqartiradi.
 * Foiz kiritilmagan (0) qiymatlar shablon bilan to'ldirilmaydi.
 */
function reconcileConsensusProbabilities(diagnoses: Diagnosis[]): void {
  if (diagnoses.length === 0) return;

  if (diagnoses.length === 1) {
    const p = diagnoses[0].probability;
    if (!Number.isFinite(p) || p <= 0) {
      diagnoses[0].probability = 0;
    } else {
      diagnoses[0].probability = Math.min(100, Math.max(0, Math.round(p)));
    }
    return;
  }

  const allPositive = diagnoses.every(d => d.probability > 0);
  if (!allPositive) {
    diagnoses.forEach(d => {
      if (Number.isFinite(d.probability) && d.probability > 0) {
        d.probability = Math.min(100, Math.max(0, Math.round(d.probability)));
      } else {
        d.probability = 0;
      }
    });
    return;
  }

  const sum = diagnoses.reduce((s, d) => s + d.probability, 0);
  if (sum <= 0) return;

  if (Math.abs(sum - 100) <= 1) {
    diagnoses.forEach(d => {
      d.probability = Math.min(100, Math.max(0, Math.round(d.probability)));
    });
    return;
  }

  const raw = diagnoses.map(d => d.probability);
  const scaled = raw.map(p => (100 * p) / sum);
  const rounded = scaled.map(x => Math.round(x));
  let drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    const idx = rounded.reduce((bestIdx, val, i, arr) => (val >= arr[bestIdx] ? i : bestIdx), 0);
    rounded[idx] = Math.min(100, Math.max(0, rounded[idx] + drift));
  }
  rounded.forEach((p, i) => {
    diagnoses[i].probability = p;
  });
}

export type ProgressUpdate =
  | { type: 'status'; message: string }
  | { type: 'thinking'; model: AIModel }
  | { type: 'differential_diagnosis'; data: Diagnosis[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'synthesis_update', data: Partial<FinalReport> }
  | { type: 'report'; data: FinalReport; detectedMedications: DetectedMedication[]; debateHistory?: ChatMessage[] }
  | { type: 'critical_finding'; data: CriticalFinding }
  | { type: 'user_question'; question: string }
  | { type: 'prognosis_update'; data: PrognosisReport }
  | { type: 'error'; message: string };

// --- EDUCATION ---

export interface PatientEducationTopic {
  title: string;
  content: string;
  language: 'uz' | 'ru' | 'en';
}

export interface CMETopic {
  topic: string;
  relevance: string; // e.g., "Based on 3 cases of acute coronary syndrome."
}

// --- DASHBOARD & HISTORY ---

/** GET /analyses/stats/ javobi (joriy foydalanuvchi tahlillari bo'yicha agregatsiya) */
export interface AnalysisStatsPayload {
  total_analyses: number;
  common_diagnoses: { name: string; count: number }[];
  feedback_accuracy: number;
  count_last_24h?: number;
  count_last_7d?: number;
  count_last_30d?: number;
}

export interface UserStats {
  totalAnalyses: number;
  commonDiagnoses: { name: string; count: number }[];
  /** 0–1, sizning «ehtimoli yuqori» belgilagan tashxislar yakuniy tashxis bilan mos kelishi */
  feedbackAccuracy: number;
  /** DDx bo‘yicha fikr kiritilgan holatlar soni (0 bo‘lsa ko‘rsatkich namuna) */
  feedbackEvalCount: number;
}

export interface AnonymizedCase {
  id: string;
  tags: string[]; // e.g., ['cardiology', 'geriatrics', 'chest pain']
  finalDiagnosis: string;
  outcome: string; // e.g., "Successfully treated with PCI"
}

// --- TOOL-SPECIFIC TYPES ---

export interface DrugInteraction {
  interaction: string;
  severity: 'High' | 'Medium' | 'Low';
  mechanism: string;
  management: string;
}

export interface EcgReport {
  rhythm: string;
  heartRate: string;
  prInterval: string;
  qrsDuration: string;
  qtInterval: string;
  axis: string;
  morphology: string;
  interpretation: string;
}

/** UZI (ultratovush) / UTT tahlil natijasi — AI tuzilgan strukturali xulosa */
export type UziUttUrgency = 'routine' | 'soon' | 'urgent' | 'emergent';

export interface UziUttReport {
  studyType: string;
  regionOrOrgan: string;
  techniqueNotes?: string;
  keyFindings: string[];
  measurements?: string;
  impression: string;
  clinicalConclusion: string;
  recommendations: string[];
  differentialDiagnosis?: string;
  limitations?: string;
  urgencyLevel: UziUttUrgency;
}

export interface Icd10Code {
  code: string;
  description: string;
}

export interface GuidelineSearchResult {
    summary: string;
    sources: {
        title: string;
        uri: string;
    }[];
}

export interface RiskScore {
    name: string; // e.g., "ASCVD Risk"
    score: string;
    interpretation: string;
}

export interface PediatricDose {
    drugName: string;
    dose: string;
    calculation: string;
    warnings: string[];
}

export interface EmergencyTemplate {
  name: string;
  description: string;
  data: Partial<PatientData>;
}
