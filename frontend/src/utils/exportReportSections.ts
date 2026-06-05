import type { FinalReport, ImagingModalityBlock } from '../types';
import { enrichFinalReport } from './reportNormalize';

export type ExportTr = (key: string, fallback: string) => string;

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
  if (r.disposition) {
    lines.push(`${tr('routing_disposition', 'Yo\'nalish')}: ${r.disposition}${r.dispositionReason ? ` — ${r.dispositionReason}` : ''}`);
  }
  if (r.hospitalizationIndicated) {
    lines.push(`${tr('routing_hospitalization', 'Statsionar')}: ${r.hospitalizationReason || tr('routing_hospitalization_default', 'Tavsiya etiladi')}`);
  }
  (r.recommendedSpecialists || []).forEach((s) => {
    lines.push(`• ${s.specialty}: ${s.reason}${s.urgency === 'urgent' ? ` (${tr('routing_urgent', 'Shoshilinch')})` : ''}`);
  });
  (r.examPlan || []).forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  if (r.followUpTimeline) lines.push(`${tr('routing_followup', 'Kuzatuv')}: ${r.followUpTimeline}`);
  return lines;
}

export function buildRiskExportLines(report: FinalReport, tr: ExportTr): string[] {
  const lines: string[] = [];
  const sev = report.severityAssessment;
  if (sev?.level) {
    const score = sev.score != null ? ` (${sev.score}/10)` : '';
    lines.push(`${tr('severity_label', 'Og\'irlik')}: ${sev.level}${score}`);
    if (sev.rationale) lines.push(sev.rationale);
    (sev.redFlags || []).forEach((f) => lines.push(`⚠ ${f}`));
  }
  (report.riskFactors || []).forEach((rf) => {
    lines.push(`• ${rf.factor}${rf.severity ? ` [${rf.severity}]` : ''}${rf.mitigation ? ` — ${rf.mitigation}` : ''}`);
  });
  return lines;
}

export function buildCheckUpExportLines(report: FinalReport, tr: ExportTr): string[] {
  return (report.checkUpRecommendations || []).map((c) => {
    const parts = [c.screeningName];
    if (c.frequency) parts.push(`${tr('checkup_frequency', 'Chastota')}: ${c.frequency}`);
    if (c.reason) parts.push(c.reason);
    if (c.guidelineSource) parts.push(`${tr('checkup_guideline_source', 'Qo\'llanma')}: ${c.guidelineSource}`);
    if (c.evidenceLevel) parts.push(`${tr('checkup_evidence_level', 'Dalil')}: ${c.evidenceLevel}`);
    return parts.join(' | ');
  });
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
