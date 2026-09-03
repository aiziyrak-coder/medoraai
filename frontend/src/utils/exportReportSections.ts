import type { FinalReport, ImagingModalityBlock } from '../types';
import { enrichFinalReport } from './reportNormalize';

/** `fallback` is optional - createExportTr's implementation already treats it so. */
export type ExportTr = (key: string, fallback?: string) => string;

/** Eksportdan oldin hisobotni normallashtirish */
export function prepareExportReport(report: FinalReport): FinalReport {
  return enrichFinalReport(report);
}

function modalityLines(
  label: string,
  block: ImagingModalityBlock | undefined,
  tr: ExportTr,
): string[] {
  if (!block?.summary && !(block?.keyFindings?.length)) return [];
  const lines: string[] = [`[${label}] ${block.summary || ''}`.trim()];
  (block.keyFindings || []).forEach((f) => lines.push(`  • ${f}`));
  if (block.clinicalSignificance) {
    lines.push(`  ${tr('final_report_imaging_significance', 'Klinik ahamiyat')}: ${block.clinicalSignificance}`);
  }
  if (block.limitations) {
    lines.push(`  ${tr('final_report_imaging_limitations', 'Cheklovlar')}: ${block.limitations}`);
  }
  return lines.filter(Boolean);
}

export function buildImagingExportLines(report: FinalReport, tr: ExportTr): string[] {
  const img = report.imagingInterpretation;
  if (img) {
    const lines = [
      ...modalityLines(tr('final_report_imaging_ecg', 'EKG'), img.ecg, tr),
      ...modalityLines(tr('final_report_imaging_uzi', 'UZI'), img.ultrasound, tr),
      ...modalityLines(tr('final_report_imaging_xray', 'Rengen'), img.xray, tr),
      ...modalityLines(tr('final_report_imaging_ct', 'KT'), img.ct, tr),
      ...modalityLines(tr('final_report_imaging_mri', 'MRI'), img.mri, tr),
    ];
    if (img.generalCorrelation) {
      lines.push(`${tr('final_report_image_correlation', 'Klinik bog\'liqlik')}: ${img.generalCorrelation}`);
    }
    if (lines.length) return lines;
  }
  if (report.imageAnalysis?.findings) {
    const out = [report.imageAnalysis.findings];
    if (report.imageAnalysis.correlation) {
      out.push(`${tr('final_report_image_correlation', 'Klinik bog\'liqlik')}: ${report.imageAnalysis.correlation}`);
    }
    return out;
  }
  return [];
}

export function buildProtocolGapsLines(report: FinalReport, tr: ExportTr): string[] {
  return (report.protocolComplianceGaps || []).flatMap((g) => {
    const parts = [g.gap];
    if (g.protocolReference) parts.push(`${tr('final_report_protocol_ref', 'Protokol')}: ${g.protocolReference}`);
    if (g.consequences) parts.push(`${tr('final_report_consequences', 'Oqibatlar')}: ${g.consequences}`);
    if (g.recommendedCorrection) parts.push(`${tr('final_report_recommended_fix', 'Tuzatish')}: ${g.recommendedCorrection}`);
    return [parts.join(' | ')];
  });
}

export function buildCareAuditLines(report: FinalReport, tr: ExportTr): string[] {
  const audit = report.careQualityAudit;
  if (!audit) return [];
  const lines: string[] = [];
  if (audit.overallScore != null) {
    lines.push(`${tr('final_report_quality_score', 'Umumiy ball')}: ${audit.overallScore}/100`);
  }
  if (audit.summary) lines.push(audit.summary);
  (audit.errors || []).forEach((e) => {
    lines.push(`• ${e.category}: ${e.description}${e.impact ? ` — ${e.impact}` : ''}`);
  });
  (audit.strengths || []).forEach((s) => {
    lines.push(`+ ${s}`);
  });
  return lines;
}

export function buildMedicationExportLine(
  med: FinalReport['medicationRecommendations'][number],
  tr: ExportTr,
): string {
  const base = [med.name, med.dosage, med.frequency, med.duration, med.timing, med.instructions, med.notes]
    .filter(Boolean)
    .join(' — ');
  const extras: string[] = [];
  if (med.adverseEffects?.length) {
    extras.push(`${tr('final_report_adverse_effects', "Nojo'ya ta'sirlar")}: ${med.adverseEffects.join('; ')}`);
  }
  if (med.contraindications) {
    extras.push(`${tr('final_report_contraindications', 'Kontrendikatsiyalar')}: ${med.contraindications}`);
  }
  if (med.monitoring) {
    extras.push(`${tr('final_report_monitoring', 'Monitoring')}: ${med.monitoring}`);
  }
  return extras.length ? `${base} | ${extras.join(' | ')}` : base;
}

export function buildRoutingExportLines(report: FinalReport, tr: ExportTr): string[] {
  const r = report.patientRouting;
  if (!r) return [];
  const lines: string[] = [];
  const dispositionLabel = (d: string) => {
    const map: Record<string, [string, string]> = {
      outpatient: ['routing_outpatient', 'Outpatient'],
      observation: ['routing_observation', 'Observation'],
      inpatient: ['routing_inpatient', 'Inpatient'],
      emergency: ['routing_emergency', 'Emergency'],
    };
    const hit = map[d.toLowerCase()];
    return hit ? tr(hit[0], hit[1]) : d;
  };
  if (r.disposition) {
    lines.push(
      `${tr('routing_disposition', 'Disposition')}: ${dispositionLabel(r.disposition)}${
        r.dispositionReason ? ` — ${r.dispositionReason}` : ''
      }`,
    );
  }
  if (r.hospitalizationIndicated) {
    lines.push(`${tr('routing_hospitalization', 'Hospitalization')}: ${r.hospitalizationReason || tr('routing_hospitalization_default', 'Recommended')}`);
  }
  (r.recommendedSpecialists || []).forEach((s) => {
    lines.push(`• ${s.specialty}: ${s.reason}${s.urgency === 'urgent' ? ` (${tr('routing_urgent', 'Urgent')})` : ''}`);
  });
  (r.examPlan || []).forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  if (r.followUpTimeline) lines.push(`${tr('routing_followup', 'Follow-up')}: ${r.followUpTimeline}`);
  return lines;
}

export function buildRiskExportLines(report: FinalReport, tr: ExportTr): string[] {
  const lines: string[] = [];
  const sev = report.severityAssessment;
  const severityLabel = (level: string) => {
    const map: Record<string, [string, string]> = {
      critical: ['severity_critical', 'Critical'],
      urgent: ['severity_urgent', 'Urgent'],
      high: ['severity_urgent', 'Urgent'],
      moderate: ['severity_moderate', 'Moderate'],
      medium: ['severity_moderate', 'Moderate'],
      low: ['severity_low', 'Low'],
    };
    const hit = map[level.toLowerCase()];
    return hit ? tr(hit[0], hit[1]) : level;
  };
  if (sev?.level) {
    const score = sev.score != null ? ` (${sev.score}/10)` : '';
    lines.push(`${tr('severity_label', 'Severity')}: ${severityLabel(String(sev.level))}${score}`);
    if (sev.rationale) lines.push(sev.rationale);
    (sev.redFlags || []).forEach((f) => lines.push(`⚠ ${f}`));
  }
  (report.riskFactors || []).forEach((rf) => {
    const sevPart = rf.severity ? ` [${severityLabel(String(rf.severity))}]` : '';
    lines.push(`• ${rf.factor}${sevPart}${rf.mitigation ? ` — ${rf.mitigation}` : ''}`);
  });
  return lines;
}

export function buildFollowUpExportLines(report: FinalReport, tr: ExportTr): string[] {
  return (report.followUpPlan || []).map((task) => {
    const who =
      task.responsible === 'Patient'
        ? tr('followup_responsible_patient', 'Bemor')
        : tr('followup_responsible_clinician', 'Shifokor');
    return [task.task, task.timeline, who].filter(Boolean).join(' — ');
  });
}

export function buildReferralExportLines(report: FinalReport, tr: ExportTr): string[] {
  return (report.referrals || []).map((ref) => {
    const urg =
      ref.urgency === 'Urgent'
        ? tr('routing_urgent', 'Shoshilinch')
        : tr('routing_routine', 'Rejadagi');
    return `${ref.specialty}: ${ref.reason} (${urg})`;
  });
}

export function buildPrognosisExportLines(report: FinalReport, tr: ExportTr): string[] {
  const p = report.prognosisReport;
  if (!p) return [];
  const lines: string[] = [];
  if (p.shortTermPrognosis) {
    lines.push(`${tr('prognosis_section_short', 'Qisqa muddatli (1–3 oy)')}: ${p.shortTermPrognosis}`);
  }
  if (p.longTermPrognosis) {
    lines.push(`${tr('prognosis_section_long', 'Uzoq muddatli (1–5 yil)')}: ${p.longTermPrognosis}`);
  }
  (p.keyFactors || []).forEach((f) => lines.push(`• ${f}`));
  return lines;
}

export function buildLifestyleExportLines(report: FinalReport, tr: ExportTr): string[] {
  const lp = report.lifestylePlan;
  if (!lp) return [];
  const lines: string[] = [];
  if (lp.diet?.length) {
    lines.push(`${tr('final_report_diet_rec', 'Ovqatlanish tavsiyalari')}: ${lp.diet.join('; ')}`);
  }
  if (lp.exercise?.length) {
    lines.push(`${tr('final_report_exercise_rec', 'Jismoniy mashqlar')}: ${lp.exercise.join('; ')}`);
  }
  (lp.other || []).forEach((r) => lines.push(`• ${r}`));
  return lines;
}

export function buildPharmacologyWarningLines(report: FinalReport): string[] {
  return (report.pharmacologyWarnings || []).filter(Boolean);
}

export function buildIndividualDietLines(report: FinalReport, tr: ExportTr): string[] {
  const plans = report.nutritionPrevention?.individualDietByDiagnosis;
  if (!plans?.length) return [];
  return plans.flatMap((plan) => {
    const lines = [`${plan.diagnosis}:`];
    if (plan.allowedFoods.length) {
      lines.push(`  ${tr('final_report_allowed_foods', 'Ruxsat')}: ${plan.allowedFoods.join('; ')}`);
    }
    if (plan.restrictedFoods.length) {
      lines.push(`  ${tr('final_report_restricted_foods', 'Cheklangan')}: ${plan.restrictedFoods.join('; ')}`);
    }
    if (plan.mealPlanNotes) lines.push(`  ${plan.mealPlanNotes}`);
    return lines;
  });
}
