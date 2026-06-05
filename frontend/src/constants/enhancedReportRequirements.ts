import { AI_CITATION_FORMAT_RULES } from './citationRules';

/** Yakuniy hisobot uchun qo'shimcha AI talablari (barcha tillarda bir xil mantiq) */
export const ENHANCED_FINAL_REPORT_AI_RULES = `
${AI_CITATION_FORMAT_RULES}
12. protocolComplianceGaps: SSV klinik protokolga nisbatan amalda qilingan yoki tavsiya etilgan davolanishdagi kamchiliklar (agar yo'q bo'lsa []). Har biri: gap, protocolReference, severity (high/medium/low), consequences (oqibatlar), recommendedCorrection.
13. careQualityAudit: overallScore (0-100), summary, errors [{category, description, protocolReference, impact}], strengths [] — tugallangan karta bo'yicha tibbiy yordam sifati.
14. imagingInterpretation: EKG/UZI/rengen/KT/MRI uchun ecg, ultrasound, xray, ct, mri (har biri: summary, keyFindings[], clinicalSignificance, limitations) va generalCorrelation.
17. patientRouting: recommendedSpecialists[{specialty, reason, urgency}], examPlan[], disposition (outpatient|observation|inpatient|emergency), dispositionReason, followUpTimeline, hospitalizationIndicated, hospitalizationReason.
18. riskFactors: [{factor, severity, mitigation}]. severityAssessment: {level: critical|urgent|moderate|low, score 1-10, rationale, redFlags[]}.
19. checkUpRecommendations: profilaktik skrining [{screeningName, frequency, reason, priority}].
15. medicationRecommendations: har dori uchun notes ichida qo'llanma + adverseEffects (nojo'ya ta'sirlar ro'yxati), contraindications, monitoring. adverseEventRisks: [{drug, risk, probability 0-1, management}].
16. nutritionPrevention.individualDietByDiagnosis: har bir asosiy tashxis uchun {diagnosis, allowedFoods[], restrictedFoods[], mealPlanNotes} — individual parhez (O'zbekiston oziq-ovqat realiati).
MUHIM: Tashxis faqat shikoyat/anamnez emas — ob'ektiv, lab, EKG/UZI/rengen, mutaxassis munozarasi va DDX sintezi asosida.
`;

export const ENHANCED_FINAL_REPORT_SCHEMA_PROPS = {
  protocolComplianceGaps: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        gap: { type: 'string' },
        protocolReference: { type: 'string' },
        severity: { type: 'string' },
        consequences: { type: 'string' },
        recommendedCorrection: { type: 'string' },
      },
    },
  },
  careQualityAudit: {
    type: 'object',
    properties: {
      overallScore: { type: 'number' },
      summary: { type: 'string' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            description: { type: 'string' },
            protocolReference: { type: 'string' },
            impact: { type: 'string' },
          },
        },
      },
      strengths: { type: 'array', items: { type: 'string' } },
    },
  },
  imagingInterpretation: {
    type: 'object',
    properties: {
      ecg: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, clinicalSignificance: { type: 'string' }, limitations: { type: 'string' } } },
      ultrasound: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, clinicalSignificance: { type: 'string' }, limitations: { type: 'string' } } },
      xray: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, clinicalSignificance: { type: 'string' }, limitations: { type: 'string' } } },
      ct: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, clinicalSignificance: { type: 'string' }, limitations: { type: 'string' } } },
      mri: { type: 'object', properties: { summary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, clinicalSignificance: { type: 'string' }, limitations: { type: 'string' } } },
      generalCorrelation: { type: 'string' },
    },
  },
  patientRouting: {
    type: 'object',
    properties: {
      recommendedSpecialists: { type: 'array', items: { type: 'object', properties: { specialty: { type: 'string' }, reason: { type: 'string' }, urgency: { type: 'string' } } } },
      examPlan: { type: 'array', items: { type: 'string' } },
      disposition: { type: 'string' },
      dispositionReason: { type: 'string' },
      followUpTimeline: { type: 'string' },
      hospitalizationIndicated: { type: 'boolean' },
      hospitalizationReason: { type: 'string' },
    },
  },
  riskFactors: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, severity: { type: 'string' }, mitigation: { type: 'string' } } } },
  severityAssessment: { type: 'object', properties: { level: { type: 'string' }, score: { type: 'number' }, rationale: { type: 'string' }, redFlags: { type: 'array', items: { type: 'string' } } } },
  checkUpRecommendations: { type: 'array', items: { type: 'object', properties: { screeningName: { type: 'string' }, frequency: { type: 'string' }, reason: { type: 'string' }, priority: { type: 'string' } } } },
  adverseEventRisks: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        drug: { type: 'string' },
        risk: { type: 'string' },
        probability: { type: 'number' },
        management: { type: 'string' },
      },
    },
  },
} as const;
