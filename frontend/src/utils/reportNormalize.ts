import type {
  FinalReport,
  ProtocolComplianceGap,
  CareQualityAudit,
  ImagingInterpretation,
  AdverseEventRisk,
  NutritionPreventionSection,
  IndividualDietPlan,
  PatientRouting,
  RiskFactor,
  SeverityAssessment,
  CheckUpRecommendation,
} from '../types';

function strList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function normalizeProtocolComplianceGaps(raw: unknown): ProtocolComplianceGap[] {
  if (!Array.isArray(raw)) return [];
  const out: ProtocolComplianceGap[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const gap = String(o.gap ?? o.deficiency ?? '').trim();
    if (!gap) continue;
    out.push({
      gap,
      protocolReference: String(o.protocolReference ?? o.protocol_reference ?? '').trim(),
      severity: (String(o.severity ?? 'medium').toLowerCase() as ProtocolComplianceGap['severity']) || 'medium',
      consequences: String(o.consequences ?? o.impact ?? '').trim(),
      recommendedCorrection: String(o.recommendedCorrection ?? o.recommended_correction ?? '').trim(),
    });
  }
  return out;
}

export function normalizeCareQualityAudit(raw: unknown): CareQualityAudit | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const errorsRaw = o.errors;
  const errors: CareQualityAudit['errors'] = [];
  if (Array.isArray(errorsRaw)) {
    for (const e of errorsRaw) {
      if (!e || typeof e !== 'object') continue;
      const r = e as Record<string, unknown>;
      const desc = String(r.description ?? r.error ?? '').trim();
      if (!desc) continue;
      errors.push({
        category: String(r.category ?? 'general').trim(),
        description: desc,
        protocolReference: String(r.protocolReference ?? r.protocol_reference ?? '').trim(),
        impact: String(r.impact ?? '').trim(),
      });
    }
  }
  let overallScore: number | undefined;
  const sc = o.overallScore ?? o.overall_score;
  if (sc != null && !Number.isNaN(Number(sc))) overallScore = Math.max(0, Math.min(100, Number(sc)));
  const summary = String(o.summary ?? '').trim();
  const strengths = strList(o.strengths);
  if (overallScore == null && !summary && errors.length === 0 && strengths.length === 0) return undefined;
  return { overallScore, summary, errors, strengths };
}

function normModality(block: unknown): ImagingInterpretation['ecg'] {
  if (!block || typeof block !== 'object') return undefined;
  const o = block as Record<string, unknown>;
  const summary = String(o.summary ?? '').trim();
  const keyFindings = strList(o.keyFindings ?? o.key_findings ?? o.findings);
  const clinicalSignificance = String(o.clinicalSignificance ?? o.clinical_significance ?? '').trim();
  const limitations = String(o.limitations ?? '').trim();
  if (!summary && keyFindings.length === 0 && !clinicalSignificance) return undefined;
  return { summary, keyFindings, clinicalSignificance, limitations: limitations || undefined };
}

export function normalizeImagingInterpretation(raw: unknown): ImagingInterpretation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const ecg = normModality(o.ecg);
  const ultrasound = normModality(o.ultrasound ?? o.uzi);
  const xray = normModality(o.xray ?? o.x_ray);
  const ct = normModality(o.ct);
  const mri = normModality(o.mri);
  const generalCorrelation = String(o.generalCorrelation ?? o.general_correlation ?? '').trim();
  if (!ecg && !ultrasound && !xray && !ct && !mri && !generalCorrelation) return undefined;
  return { ecg, ultrasound, xray, ct, mri, generalCorrelation: generalCorrelation || undefined };
}

export function normalizePatientRouting(raw: unknown): PatientRouting | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const specialistsRaw = o.recommendedSpecialists ?? o.recommended_specialists ?? o.referrals;
  const recommendedSpecialists: PatientRouting['recommendedSpecialists'] = [];
  if (Array.isArray(specialistsRaw)) {
    for (const s of specialistsRaw) {
      if (!s || typeof s !== 'object') continue;
      const r = s as Record<string, unknown>;
      const specialty = String(r.specialty ?? '').trim();
      if (!specialty) continue;
      const urgency = String(r.urgency ?? '').toLowerCase();
      recommendedSpecialists.push({
        specialty,
        reason: String(r.reason ?? '').trim(),
        urgency: urgency === 'urgent' ? 'urgent' : 'routine',
      });
    }
  }
  const examPlan = strList(o.examPlan ?? o.exam_plan);
  const disposition = String(o.disposition ?? '').toLowerCase() as PatientRouting['disposition'];
  const validDisposition = ['outpatient', 'observation', 'inpatient', 'emergency'].includes(disposition || '')
    ? disposition
    : undefined;
  const routing: PatientRouting = {
    recommendedSpecialists: recommendedSpecialists.length ? recommendedSpecialists : undefined,
    examPlan: examPlan.length ? examPlan : undefined,
    disposition: validDisposition,
    dispositionReason: String(o.dispositionReason ?? o.disposition_reason ?? '').trim() || undefined,
    followUpTimeline: String(o.followUpTimeline ?? o.follow_up_timeline ?? '').trim() || undefined,
    hospitalizationIndicated: o.hospitalizationIndicated === true || o.hospitalization_indicated === true,
    hospitalizationReason: String(o.hospitalizationReason ?? o.hospitalization_reason ?? '').trim() || undefined,
  };
  const hasContent =
    (routing.recommendedSpecialists?.length ?? 0) > 0 ||
    (routing.examPlan?.length ?? 0) > 0 ||
    !!routing.disposition ||
    routing.hospitalizationIndicated ||
    !!routing.followUpTimeline;
  return hasContent ? routing : undefined;
}

export function normalizeRiskFactors(raw: unknown): RiskFactor[] {
  if (!Array.isArray(raw)) return [];
  const out: RiskFactor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const factor = String(o.factor ?? '').trim();
    if (!factor) continue;
    const sev = String(o.severity ?? '').toLowerCase();
    out.push({
      factor,
      severity: (['high', 'medium', 'low'].includes(sev) ? sev : undefined) as RiskFactor['severity'],
      mitigation: String(o.mitigation ?? '').trim() || undefined,
    });
  }
  return out;
}

export function normalizeSeverityAssessment(raw: unknown): SeverityAssessment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const levelRaw = String(o.level ?? '').toLowerCase();
  const level = (['critical', 'urgent', 'moderate', 'low'].includes(levelRaw)
    ? levelRaw
    : undefined) as SeverityAssessment['level'];
  let score: number | undefined;
  if (o.score != null && !Number.isNaN(Number(o.score))) score = Math.max(1, Math.min(10, Number(o.score)));
  const rationale = String(o.rationale ?? '').trim();
  const redFlags = strList(o.redFlags ?? o.red_flags);
  if (!level && score == null && !rationale && redFlags.length === 0) return undefined;
  return { level: level || 'moderate', score, rationale: rationale || undefined, redFlags: redFlags.length ? redFlags : undefined };
}

export function normalizeCheckUpRecommendations(raw: unknown): CheckUpRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckUpRecommendation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const screeningName = String(o.screeningName ?? o.screening_name ?? '').trim();
    if (!screeningName) continue;
    const pr = String(o.priority ?? '').toLowerCase();
    out.push({
      screeningName,
      frequency: String(o.frequency ?? '').trim(),
      reason: String(o.reason ?? '').trim(),
      priority: (['high', 'medium', 'low'].includes(pr) ? pr : 'medium') as CheckUpRecommendation['priority'],
      category: String(o.category ?? '').trim() || undefined,
      guidelineSource: String(o.guidelineSource ?? o.guideline_source ?? '').trim() || undefined,
      sourceUrl: String(o.sourceUrl ?? o.source_url ?? '').trim() || undefined,
      nextSuggested: String(o.nextSuggested ?? o.next_suggested ?? '').trim() || undefined,
      evidenceLevel: String(o.evidenceLevel ?? o.evidence_level ?? '').trim() || undefined,
    });
  }
  return out;
}

export function normalizeAdverseEventRisks(raw: unknown): AdverseEventRisk[] {
  if (!Array.isArray(raw)) return [];
  const out: AdverseEventRisk[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const drug = String(o.drug ?? o.name ?? '').trim();
    const risk = String(o.risk ?? '').trim();
    if (!drug || !risk) continue;
    let probability = Number(o.probability ?? 0.3);
    if (Number.isNaN(probability)) probability = 0.3;
    probability = Math.max(0, Math.min(1, probability));
    out.push({
      drug,
      risk,
      probability,
      management: String(o.management ?? '').trim(),
    });
  }
  return out;
}

export function normalizeNutritionExtended(raw: unknown): NutritionPreventionSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const dietaryGuidelines = strList(o.dietaryGuidelines ?? o.dietary_guidelines);
  const preventionMeasures = strList(o.preventionMeasures ?? o.prevention_measures);
  const intro = String(o.intro ?? '').trim() || undefined;
  const disclaimer = String(o.disclaimer ?? '').trim() || undefined;
  const rowsRaw = o.individualDietByDiagnosis ?? o.individual_diet_by_diagnosis;
  const individualDietByDiagnosis: IndividualDietPlan[] = [];
  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const diagnosis = String(r.diagnosis ?? '').trim();
      if (!diagnosis) continue;
      individualDietByDiagnosis.push({
        diagnosis,
        allowedFoods: strList(r.allowedFoods ?? r.allowed_foods),
        restrictedFoods: strList(r.restrictedFoods ?? r.restricted_foods),
        mealPlanNotes: String(r.mealPlanNotes ?? r.meal_plan_notes ?? '').trim(),
      });
    }
  }
  if (
    dietaryGuidelines.length === 0 &&
    preventionMeasures.length === 0 &&
    !intro &&
    individualDietByDiagnosis.length === 0
  ) {
    return undefined;
  }
  return {
    intro,
    disclaimer,
    dietaryGuidelines,
    preventionMeasures,
    individualDietByDiagnosis: individualDietByDiagnosis.length ? individualDietByDiagnosis : undefined,
  };
}

/** Yakuniy hisobotni boyitilgan maydonlar bilan birlashtiradi */
export function enrichFinalReport(raw: FinalReport): FinalReport {
  const r = raw as FinalReport & Record<string, unknown>;
  const out: FinalReport = { ...raw };

  const gaps = normalizeProtocolComplianceGaps(r.protocolComplianceGaps ?? r.protocol_compliance_gaps);
  if (gaps.length) out.protocolComplianceGaps = gaps;

  const audit = normalizeCareQualityAudit(r.careQualityAudit ?? r.care_quality_audit);
  if (audit) out.careQualityAudit = audit;

  const imaging = normalizeImagingInterpretation(r.imagingInterpretation ?? r.imaging_interpretation);
  if (imaging) {
    out.imagingInterpretation = imaging;
    const parts: string[] = [];
    if (imaging.ecg?.summary) parts.push(`ECG: ${imaging.ecg.summary}`);
    if (imaging.ultrasound?.summary) parts.push(`US: ${imaging.ultrasound.summary}`);
    if (imaging.xray?.summary) parts.push(`XR: ${imaging.xray.summary}`);
    if (imaging.ct?.summary) parts.push(`CT: ${imaging.ct.summary}`);
    if (imaging.mri?.summary) parts.push(`MRI: ${imaging.mri.summary}`);
    if (parts.length) {
      out.imageAnalysis = {
        findings: parts.join(' | '),
        correlation: imaging.generalCorrelation || out.imageAnalysis?.correlation || '',
      };
    }
  }

  const aer = normalizeAdverseEventRisks(r.adverseEventRisks ?? r.adverse_event_risks);
  if (aer.length) out.adverseEventRisks = aer;

  const np = normalizeNutritionExtended(r.nutritionPrevention ?? r.nutrition_prevention);
  if (np) out.nutritionPrevention = np;

  if (Array.isArray(out.medicationRecommendations)) {
    out.medicationRecommendations = out.medicationRecommendations.map((m) => ({ ...m }));
  }

  const routing = normalizePatientRouting(r.patientRouting ?? r.patient_routing);
  if (routing) out.patientRouting = routing;

  const risks = normalizeRiskFactors(r.riskFactors ?? r.risk_factors);
  if (risks.length) out.riskFactors = risks;

  const severity = normalizeSeverityAssessment(r.severityAssessment ?? r.severity_assessment);
  if (severity) out.severityAssessment = severity;

  const checkUp = normalizeCheckUpRecommendations(r.checkUpRecommendations ?? r.check_up_recommendations);
  if (checkUp.length) out.checkUpRecommendations = checkUp;

  return out;
}
