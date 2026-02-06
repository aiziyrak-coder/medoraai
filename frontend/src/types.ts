
import { AIModel } from './constants/specialists';

// Original types - some modified for new features
export { AIModel };

export type AppView = 'dashboard' | 'new_analysis' | 'clarification' | 'team_recommendation' | 'live_analysis' | 'history' | 'view_history_item' | 'case_library' | 'research' | 'live_consultation' | 'prescription' | 'patient_education' | 'tumor_board' | 'longitudinal_view' | 'staff_dashboard' | 'tv_display' | 'subscription';

export type UserRole = 'clinic' | 'doctor' | 'staff';

export type SubscriptionStatus = 'active' | 'inactive' | 'pending';

/** Obuna rejasi: clinic (500$/oy, shartnoma) yoki doctor (10$/oy, chek) */
export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  plan_type?: 'clinic' | 'doctor';
  description?: string;
  price_monthly: number;
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
  specialties?: string[]; // For doctors
  linkedDoctorId?: string; // For staff, links to their doctor
  assistantId?: string; // For doctors, links to their assistant
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiry?: string;
  subscriptionPlan?: SubscriptionPlan | null;
  trialEndsAt?: string | null;
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
  firstName: string;
  lastName: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
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
    summary: string;
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
    notes: string;
    localAvailability?: string; // e.g., "O'zbekistonda bor: Nimesil, Nise"
    priceEstimate?: string; // e.g., "~45,000 so'm"
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
}


export type ProgressUpdate =
  | { type: 'status'; message: string }
  | { type: 'thinking'; model: AIModel }
  | { type: 'differential_diagnosis'; data: Diagnosis[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'synthesis_update', data: Partial<FinalReport> }
  | { type: 'report'; data: FinalReport; detectedMedications: DetectedMedication[] }
  | { type: 'critical_finding'; data: CriticalFinding }
  | { type: 'user_question'; question: string }
  | { type: 'prognosis_update'; data: PrognosisReport }
  | { type: 'error'; message: string };

// --- RESEARCH & EDUCATION ---

export interface TreatmentStrategy {
    name: string;
    mechanism: string;
    evidence: string;
    pros: string[];
    cons: string[];
    riskBenefit: {
        risk: 'Low' | 'Medium' | 'High' | 'Very High' | 'N/A';
        benefit: 'Incremental' | 'Significant' | 'Breakthrough' | 'N/A';
    };
    developmentRoadmap: {
        stage: string;
        duration: string;
        cost: string;
    }[];
    molecularTarget: {
        name: string;
        pdbId?: string;
    };
    ethicalConsiderations: string[];
    requiredCollaborations: string[];
    companionDiagnosticNeeded: string;
}

export interface ClinicalGuideline {
    guidelineTitle: string;
    source: string;
    recommendations: {
        category: string;
        details: string[];
    }[];
}

export interface ResearchReport {
    diseaseName: string;
    summary: string;
    epidemiology: {
        prevalence: string;
        incidence: string;
        keyRiskFactors: string[];
    };
    pathophysiology: string;
    emergingBiomarkers: {
        name: string;
        type: 'Prognostic' | 'Predictive' | 'Diagnostic';
        description: string;
    }[];
    clinicalGuidelines: ClinicalGuideline[];
    potentialStrategies: TreatmentStrategy[];
    pharmacogenomics: {
        relevantGenes: { gene: string; mutation: string; impact: string }[];
        targetSubgroup: string;
    };
    patentLandscape: {
        competingPatents: { patentId: string; title: string; assignee: string }[];
        whitespaceOpportunities: string[];
    };
    relatedClinicalTrials: {
        trialId: string;
        title: string;
        status: string;
        url: string;
    }[];
    strategicConclusion: string;
    sources: {
      title: string;
      uri: string;
    }[];
}

export type ResearchProgressUpdate =
  | { type: 'status'; message: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'report'; data: ResearchReport }
  | { type: 'error'; message: string };
  
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

export interface UserStats {
  totalAnalyses: number;
  commonDiagnoses: { name: string; count: number }[];
  feedbackAccuracy: number; // 0-1, how often user feedback matched final diagnosis
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

export interface VitalSigns {
    heartRate: number;
    spO2: number;
    bpSystolic: number;
    bpDiastolic: number;
    respirationRate: number;
}
