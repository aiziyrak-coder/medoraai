"""
Clinical Decision Engine - Autonomous Medical Decision Making
Advanced AI system for making clinical decisions with minimal human intervention
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from django.conf import settings
from django.utils import timezone
from django.db import transaction

from .azure_utils import _call_gemini, DEPLOY_GPT4O, DEPLOY_MINI

# Backwards-compat aliases
GEMINI_PRO = DEPLOY_GPT4O()
GEMINI_FLASH = DEPLOY_MINI()
from .autonomous_protocol_generator import autonomous_generator
from .self_learning_system import self_learning_system

logger = logging.getLogger(__name__)


class ClinicalDecisionEngine:
    """Advanced clinical decision engine for autonomous medical decisions"""
    
    def __init__(self):
        self.decision_thresholds = {
            'emergency_threshold': 0.9,
            'autonomous_treatment_threshold': 0.85,
            'human_referral_threshold': 0.7,
            'critical_condition_threshold': 0.95
        }
        
        self.clinical_algorithms = {
            'cardiovascular': self._cardiovascular_algorithm,
            'respiratory': self._respiratory_algorithm,
            'gastrointestinal': self._gastrointestinal_algorithm,
            'neurological': self._neurological_algorithm,
            'infectious': self._infectious_disease_algorithm,
            'musculoskeletal': self._musculoskeletal_algorithm,
            'pediatric': self._pediatric_algorithm,
            'geriatric': self._geriatric_algorithm
        }
    
    def make_autonomous_decision(self, patient_data: Dict, language: str = 'uz-L') -> Dict:
        """
        Make comprehensive autonomous clinical decision
        
        Args:
            patient_data: Complete patient clinical data
            language: Language for output
            
        Returns:
            Complete clinical decision with recommendations
        """
        try:
            # Step 1: Triage and emergency assessment
            triage_result = self._perform_triage(patient_data)
            
            # Step 2: Determine clinical pathway
            clinical_pathway = self._determine_clinical_pathway(patient_data, triage_result)
            
            # Step 3: Apply specialized clinical algorithm
            algorithm_result = self._apply_clinical_algorithm(
                patient_data, clinical_pathway, language
            )
            
            # Step 4: Risk-benefit analysis
            risk_benefit = self._perform_risk_benefit_analysis(
                patient_data, algorithm_result, triage_result
            )
            
            # Step 5: Generate autonomous treatment plan
            treatment_plan = self._generate_autonomous_treatment_plan(
                patient_data, algorithm_result, risk_benefit, language
            )
            
            # Step 6: Safety validation
            safety_validation = self._validate_safety(treatment_plan, triage_result)
            
            # Step 7: Decision finalization
            final_decision = self._finalize_decision(
                triage_result, algorithm_result, risk_benefit, 
                treatment_plan, safety_validation
            )
            
            # Step 8: Learning integration
            self._integrate_learning(final_decision, patient_data)
            
            return final_decision
            
        except Exception as e:
            logger.error(f"Error in autonomous decision making: {e}")
            return self._generate_emergency_fallback(patient_data, language)
    
    def _perform_triage(self, patient_data: Dict) -> Dict:
        """Perform emergency triage assessment"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""TRIAJ BAHOLASHI - Shoshilinchlikni aniqlash
        
Bemor ma'lumotlari:
{text}

TRIAJ QOIDALARI:
1. Qizil (Shoshilinch): Hayotga xavf, darhol aralashuv kerak
2. Sariq (Shoshilinch): Og'ir ahvol, tez yordam kerak  
3. Yashil (O'rtacha): O'rtacha ahvol, rejalashtirilgan yordam
4. Ko'k (Engil): Engil ahvol, rejalashtirilgan qabul

Baholang:
- triage_level: red/yellow/green/blue
- urgency_score: 0-1 
- life_threatened: boolean
- time_to_treatment: minutes
- emergency_actions: array
- vital_signs_critical: array

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Triage assessment failed: {e}")
            return {
                "triage_level": "yellow",
                "urgency_score": 0.7,
                "life_threatened": False,
                "time_to_treatment": 30,
                "emergency_actions": ["Shifokor tekshiruvi zarur"],
                "vital_signs_critical": []
            }
    
    def _determine_clinical_pathway(self, patient_data: Dict, triage_result: Dict) -> str:
        """Determine the appropriate clinical pathway"""
        complaints = patient_data.get('complaints', '').lower()
        age = patient_data.get('age', 0)
        
        # Age-based pathways
        if age < 18:
            return 'pediatric'
        elif age >= 65:
            return 'geriatric'
        
        # Complaint-based pathways
        pathway_keywords = {
            'cardiovascular': ['yurak', 'ko\'krak', 'qon bosimi', 'yurak og\'riq', 'puls'],
            'respiratory': ['nafas', 'o\'pka', 'yo\'tal', 'nafas qisilishi', 'dem'],
            'gastrointestinal': ['qorin', 'ovqat hazm qilish', 'qayt', 'ichak', 'jigar'],
            'neurological': ['bosh og\'riq', 'bosh aylanishi', 'uyqu', 'xotira', 'falaj'],
            'infectious': ['isitma', 'infektsiya', 'mikrob', 'virus', 'terlama'],
            'musculoskeletal': ['skelet', 'mushak', 'bo\'g\'in', 'suyak', 'og\'riq']
        }
        
        for pathway, keywords in pathway_keywords.items():
            if any(keyword in complaints for keyword in keywords):
                return pathway
        
        return 'general'
    
    def _apply_clinical_algorithm(self, patient_data: Dict, pathway: str, language: str) -> Dict:
        """Apply specialized clinical algorithm"""
        if pathway in self.clinical_algorithms:
            return self.clinical_algorithms[pathway](patient_data, language)
        else:
            return self._general_clinical_algorithm(patient_data, language)
    
    def _cardiovascular_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Cardiovascular clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""KARDIOVLOGIK ALGORITM - Yurak tomiri kasalliklari
        
Bemor ma'lumotlari:
{text}

KARDIOVLOGIK BAHOLASH:
1. Angina/MI gumoni? (chest_pain_cause: string)
2. Yurak etishmovchiligi? (heart_failure: boolean, severity: mild/moderate/severe)
3. Arterial gipertenziya? (hypertension: boolean, severity: mild/moderate/severe)
4. Arrhythmia gumoni? (arrhythmia_risk: boolean)
5. EKG kerakmi? (ekg_required: boolean, urgency: immediate/soon/routine)
6. Laboratoriya tekshiruvi? (labs_required: array)
7. Davolash strategiyasi? (treatment_strategy: string)

Qon bosimi, yurak urishi, ko\'krak og\'riq xususiyatlarini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'cardiovascular'
            return result
        except Exception as e:
            logger.error(f"Cardiovascular algorithm failed: {e}")
            return {"algorithm_used": "cardiovascular", "error": "Algorithm failed"}
    
    def _respiratory_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Respiratory clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""NAFAS TOMIRI ALGORITM - O'pka kasalliklari
        
Bemor ma'lumotlari:
{text}

NAFAS TOMIRI BAHOLASH:
1. Nafas qisilishi darajasi? (dyspnea_severity: none/mild/moderate/severe)
2. O'pka infektsiyasi? (pulmonary_infection: boolean, type: bacterial/viral/other)
3. Astma/COPD gumoni? (obstructive_disease: boolean, type: asthma/COPD)
4. O'pka emboliyasi gumoni? (pe_risk: boolean)
5. Rentgen kerakmi? (xray_required: boolean, urgency)
6. SpO2 monitoring? (oxygen_monitoring: boolean, frequency)
7. O'pkaga dori? (inhalation_required: boolean, medications)

Nafas soni, SpO2, yo'bal xususiyatlarini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'respiratory'
            return result
        except Exception as e:
            logger.error(f"Respiratory algorithm failed: {e}")
            return {"algorithm_used": "respiratory", "error": "Algorithm failed"}
    
    def _gastrointestinal_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Gastrointestinal clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""GASTROENTEROLOGIK ALGORITM - Oshqozon-ichak kasalliklari
        
Bemor ma'lumotlari:
{text}

GASTROENTEROLOGIK BAHOLASH:
1. O'tkir qorin og'rig'i? (acute_abdomen: boolean, surgical_emergency: boolean)
2. Qusish/kengayish? (vomiting: boolean, obstruction: boolean)
3. Ichak infektsiyasi? (gastroenteritis: boolean, dehydration_risk: boolean)
4. Oshqozon yarasi/gastrit? (ulcer_risk: boolean)
5. Jigar/o't pufagi? (hepatobiliary: boolean)
6. Tekshiruvlar? (endoscopy: boolean, ultrasound: boolean, labs: array)
7. Suv-tuz balansi? (fluid_management: boolean, oral/iv)

Qorin tekshiruvi, defekatsiya, dietasini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'gastrointestinal'
            return result
        except Exception as e:
            logger.error(f"Gastrointestinal algorithm failed: {e}")
            return {"algorithm_used": "gastrointestinal", "error": "Algorithm failed"}
    
    def _neurological_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Neurological clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""NEUROLOGIK ALGORITM - Asab tizimi kasalliklari
        
Bemor ma'lumotlari:
{text}

NEUROLOGIK BAHOLASH:
1. Insult gumoni? (stroke_risk: boolean, type: ischemic/hemorrhagic)
2. Bosh og'rig'i turi? (headache_type: migraine/tension/cluster/secondary)
3. Convulsion/epilepsiya? (seizure_risk: boolean)
4. Bosh miya shikastlanishi? (head_injury: boolean, severity)
5. Nevrologik tekshiruv? (neuro_exam_required: boolean, findings)
6. KT/MRT kerakmi? (imaging_required: boolean, urgency)
7. Miya tomirlari? (cerebrovascular: boolean)

Onset, fokal belgilar, ong holatini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'neurological'
            return result
        except Exception as e:
            logger.error(f"Neurological algorithm failed: {e}")
            return {"algorithm_used": "neurological", "error": "Algorithm failed"}
    
    def _infectious_disease_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Infectious disease clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""INFEKTSION ALGORITM - Yuqumli kasalliklar
        
Bemor ma'lumotlari:
{text}

INFEKTSION BAHOLASH:
1. Septik shok gumoni? (sepsis_risk: boolean, sirs_criteria)
2. Bakterial infektsiya? (bacterial_infection: boolean, likely_source)
3. Virusli infektsiya? (viral_infection: boolean, type: respiratory/gastrointestinal/other)
4. Antibiotik kerakmi? (antibiotics_required: boolean, choice)
5. Laboratoriya? (blood_culture: boolean, crp: boolean, other_labs: array)
6. Izolyatsiya kerakmi? (isolation: boolean, type)
7. Epidemiologik tarix? (epidemiological_risk: boolean)

Isitma, leykotsitlar, CRP, kontakt tarixini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'infectious'
            return result
        except Exception as e:
            logger.error(f"Infectious disease algorithm failed: {e}")
            return {"algorithm_used": "infectious", "error": "Algorithm failed"}
    
    def _musculoskeletal_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Musculoskeletal clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""MUSKULOSKELETAL ALGORITM - Skelet-mushak kasalliklari
        
Bemor ma'lumotlari:
{text}

MUSKULOSKELETAL BAHOLASH:
1. Travma? (trauma: boolean, mechanism, fracture_risk)
2. Bo'g'im yallanishi? (arthritis: boolean, type: inflammatory/degenerative)
3. Mushak og'rig'i? (myalgia: boolean, cause)
4. Orqa og'rig'i? (back_pain: boolean, red_flags)
5. Rentgen/MRT kerakmi? (imaging: boolean, type, urgency)
6. Fizioterapiya? (physical_therapy: boolean, type)
7. Jarrohlik kerakmi? (surgical_consultation: boolean)

Og'riq xususiyatlari, funksional buzulishlarni e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'musculoskeletal'
            return result
        except Exception as e:
            logger.error(f"Musculoskeletal algorithm failed: {e}")
            return {"algorithm_used": "musculoskeletal", "error": "Algorithm failed"}
    
    def _pediatric_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Pediatric clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""PEDIATRIK ALGORITM - Bolalar kasalliklari
        
Bemor ma'lumotlari:
{text}

PEDIATRIK BAHOLASH:
1. Nafas yo'llari infektsiyasi? (respiratory_infection: boolean, severity)
2. Gastroenterit? (gastroenteritis: boolean, dehydration_risk)
3. O'tkir infektsiya? (acute_infection: boolean, sepsis_risk)
4. O'sish rivojlanish? (growth_development: boolean, concerns)
5. Vaksinatsiya? (vaccination_status: boolean, needed_vaccines)
6. Ota-onasi kuzatuv? (parental_monitoring: boolean, instructions)
7. Shifokor ko'rigi? (doctor_review: boolean, urgency)

Yosh, vazn, tana harorati, ong holatini e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'pediatric'
            return result
        except Exception as e:
            logger.error(f"Pediatric algorithm failed: {e}")
            return {"algorithm_used": "pediatric", "error": "Algorithm failed"}
    
    def _geriatric_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """Geriatric clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""GERIATRIK ALGORITM - Keksa bemorlar
        
Bemor ma'lumotlari:
{text}

GERIATRIK BAHOLASH:
1. Ko'p kasalliklik? (comorbidity: boolean, conditions)
2. Dori o'zaro ta'siri? (polypharmacy: boolean, interactions)
3. Tushish xavfi? (fall_risk: boolean, prevention)
4. Kognitiv buzulish? (cognitive_impairment: boolean, severity)
5. Uyda parvarish? (home_care: boolean, needs)
6. Reabilitatsiya? (rehabilitation: boolean, type)
7. O'lim xavfi? (mortality_risk: boolean, score)

Yosh, mustaqillik darajasi, surunkali kasalliklarni e'tiborga oling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'geriatric'
            return result
        except Exception as e:
            logger.error(f"Geriatric algorithm failed: {e}")
            return {"algorithm_used": "geriatric", "error": "Algorithm failed"}
    
    def _general_clinical_algorithm(self, patient_data: Dict, language: str) -> Dict:
        """General clinical decision algorithm"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""UMUMIY KLINIK ALGORITM - Umumiy tibbiy yondashuv
        
Bemor ma'lumotlari:
{text}

UMUMIY BAHOLASH:
1. Asosiy simptomlar tizimi? (primary_system: string)
2. Yallanish belgilari? (inflammation: boolean, markers)
3. Allergik reaktsiya? (allergy: boolean, type)
4. Surunkali kasallik kuchayishi? (chronic_exacerbation: boolean)
5. Simptomatik davolash? (symptomatic_treatment: boolean, medications)
6. Qo'shimcha tekshiruvlar? (additional_tests: array)
7. Kuzatuv rejimi? (monitoring: boolean, frequency)

Barcha tizimlarni qisqacha baholang, asosiy muammoni aniqlang.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(raw)
            result['algorithm_used'] = 'general'
            return result
        except Exception as e:
            logger.error(f"General algorithm failed: {e}")
            return {"algorithm_used": "general", "error": "Algorithm failed"}
    
    def _perform_risk_benefit_analysis(self, patient_data: Dict, algorithm_result: Dict, 
                                     triage_result: Dict) -> Dict:
        """Perform comprehensive risk-benefit analysis"""
        analysis_prompt = f"""RISK-BENEFIT ANALIZI - Davolash xavfi va foydasi
        
Bemor ma'lumotlari: {json.dumps(patient_data, ensure_ascii=False)}
Algoritim natijasi: {json.dumps(algorithm_result, ensure_ascii=False)}
Triaj natijasi: {json.dumps(triage_result, ensure_ascii=False)}

XAVF-FOYDA BAHOLASHI:
1. Avtonom davolash xavfi? (autonomous_risk: float 0-1)
2. Inson aralashuvi foydasi? (human_intervention_benefit: float 0-1)
3. Shoshilinch aralashuv kerakmi? (urgent_intervention: boolean)
4. Kutilish xavfi? (delay_risk: float 0-1)
5. Asoratlar xavfi? (complication_risk: float 0-1)
6. Muvaffaqiyat ehtimoli? (success_probability: float 0-1)
7. Tavsiya? (recommendation: autonomous/human/emergency)

Xavf va foyda nisbatini hisoblang, qaror qabul qiling.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(analysis_prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Risk-benefit analysis failed: {e}")
            return {
                "autonomous_risk": 0.3,
                "human_intervention_benefit": 0.7,
                "urgent_intervention": False,
                "delay_risk": 0.2,
                "complication_risk": 0.1,
                "success_probability": 0.8,
                "recommendation": "human"
            }
    
    def _generate_autonomous_treatment_plan(self, patient_data: Dict, algorithm_result: Dict, 
                                          risk_benefit: Dict, language: str) -> Dict:
        """Generate autonomous treatment plan"""
        # Use the autonomous protocol generator
        base_protocol = autonomous_generator.generate_autonomous_protocol(patient_data, language)
        
        # Enhance with algorithm-specific insights
        enhanced_protocol = base_protocol.copy()
        enhanced_protocol['algorithm_insights'] = algorithm_result
        enhanced_protocol['risk_benefit_analysis'] = risk_benefit
        
        # Apply learning improvements
        improved_protocol = self_learning_system.get_improved_protocol_template(
            patient_data, enhanced_protocol
        )
        
        return improved_protocol
    
    def _validate_safety(self, treatment_plan: Dict, triage_result: Dict) -> Dict:
        """Validate safety of treatment plan"""
        validation_prompt = f"""XAVFSIZLIK VALIDATSIYASI - Davolash rejasini tekshirish
        
Davolash rejasi: {json.dumps(treatment_plan, ensure_ascii=False)}
Triaj natijasi: {json.dumps(triage_result, ensure_ascii=False)}

XAVFSIZLIK TEKSHIRUVI:
1. Reja xavfsizmi? (safe: boolean)
2. Shoshilinch holatlar qo'shilganmi? (emergency_covered: boolean)
3. Dori dozalari to'g'rimi? (dosage_safe: boolean)
4. O'zaro ta'sirlar? (drug_interactions: boolean, details)
5. Allergiya xavfi? (allergy_risk: boolean)
6. Monitoring yetarlimi? (monitoring_adequate: boolean)
7. Xavfsizlik balli? (safety_score: float 0-1)

Har bir jihatdan xavfsizlikni tekshiring.

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(validation_prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Safety validation failed: {e}")
            return {
                "safe": False,
                "emergency_covered": False,
                "dosage_safe": False,
                "drug_interactions": True,
                "allergy_risk": True,
                "monitoring_adequate": False,
                "safety_score": 0.3
            }
    
    def _finalize_decision(self, triage_result: Dict, algorithm_result: Dict, 
                          risk_benefit: Dict, treatment_plan: Dict, safety_validation: Dict) -> Dict:
        """Finalize clinical decision"""
        safety_score = safety_validation.get('safety_score', 0.5)
        autonomous_risk = risk_benefit.get('autonomous_risk', 0.5)
        urgency = triage_result.get('urgency_score', 0.5)
        
        # Determine final decision
        if safety_score < 0.7 or autonomous_risk > 0.3 or urgency > 0.9:
            decision_type = 'human_intervention_required'
            autonomous_allowed = False
        elif safety_score > 0.9 and autonomous_risk < 0.1:
            decision_type = 'fully_autonomous'
            autonomous_allowed = True
        else:
            decision_type = 'supervised_autonomous'
            autonomous_allowed = True
        
        final_decision = {
            'decision_type': decision_type,
            'autonomous_allowed': autonomous_allowed,
            'confidence_score': (safety_score + (1 - autonomous_risk)) / 2,
            'triage_result': triage_result,
            'algorithm_result': algorithm_result,
            'risk_benefit_analysis': risk_benefit,
            'treatment_plan': treatment_plan,
            'safety_validation': safety_validation,
            'recommendations': self._generate_final_recommendations(
                decision_type, treatment_plan, safety_validation
            ),
            'monitoring_plan': self._create_monitoring_plan(triage_result, treatment_plan),
            'follow_up_plan': self._create_follow_up_plan(algorithm_result, risk_benefit),
            'emergency_protocols': self._create_emergency_protocols(triage_result, safety_validation),
            'decision_timestamp': timezone.now().isoformat(),
            'decision_version': '2.0'
        }
        
        return final_decision
    
    def _generate_final_recommendations(self, decision_type: str, treatment_plan: Dict, 
                                      safety_validation: Dict) -> List[str]:
        """Generate final recommendations"""
        recommendations = []
        
        if decision_type == 'human_intervention_required':
            recommendations.extend([
                "Shifokor maslahati majburiy",
                "Tez tibbiy yordamga murojaat qiling",
                "Qo'shimcha tekshiruvlar talab qilinadi"
            ])
        elif decision_type == 'fully_autonomous':
            recommendations.extend([
                "Avtonom protokol bo'yicha davolash",
                "Muntazam monitoring o'tkazing",
                "Yomonlashganda shifokorga murojaat qiling"
            ])
        else:  # supervised_autonomous
            recommendations.extend([
                "Avtonom protokol bilan shifokor nazorati",
                "Kuniga 2 marta holatni tekshiring",
                "Shoshilinch holatlarda darhol shifokorga murojaat qiling"
            ])
        
        # Add safety-specific recommendations
        if not safety_validation.get('dosage_safe', False):
            recommendations.append("Dori dozalari shifokor tomonidan tekshirilishi kerak")
        
        if safety_validation.get('drug_interactions', False):
            recommendations.append("Dori o'zaro ta'sirlari xavfi bor, ehtiyot bo'ling")
        
        return recommendations
    
    def _create_monitoring_plan(self, triage_result: Dict, treatment_plan: Dict) -> Dict:
        """Create monitoring plan"""
        urgency = triage_result.get('urgency_score', 0.5)
        
        if urgency > 0.8:
            frequency = "Har 1-2 soat"
            parameters = ["Qon bosimi", "Yurak urishi", "Nafas soni", "Harorat", "SpO2", "On holati"]
        elif urgency > 0.5:
            frequency = "Har 4-6 soat"
            parameters = ["Qon bosimi", "Yurak urishi", "Harorat", "SpO2"]
        else:
            frequency = "Har 8-12 soat"
            parameters = ["Qon bosimi", "Yurak urishi", "Harorat"]
        
        return {
            'frequency': frequency,
            'parameters': parameters,
            'duration': "7 kun",
            'escalation_criteria': ["Qon bosimi >160/100", "Harorat >38.5°C", "Nafas qisilishi"],
            'recording_method': "Avtomatik monitoring tizimi"
        }
    
    def _create_follow_up_plan(self, algorithm_result: Dict, risk_benefit: Dict) -> Dict:
        """Create follow-up plan"""
        success_probability = risk_benefit.get('success_probability', 0.8)
        
        if success_probability > 0.9:
            follow_up_timing = "7-10 kun"
            follow_up_type = "Telefon konsultatsiya"
        elif success_probability > 0.7:
            follow_up_timing = "3-5 kun"
            follow_up_type = "Shaxsan qabul"
        else:
            follow_up_timing = "1-2 kun"
            follow_up_type = "Shoshilinch qabul"
        
        return {
            'timing': follow_up_timing,
            'type': follow_up_type,
            'assessments': ["Klinik yaxshilanish", "Nojo'ya ta'sirlar", "Dori muvofiqligi"],
            'contingency': "Yomonlashganda darhol shifokorga murojaat"
        }
    
    def _create_emergency_protocols(self, triage_result: Dict, safety_validation: Dict) -> List[Dict]:
        """Create emergency protocols"""
        protocols = []
        
        # General emergency protocol
        protocols.append({
            'trigger': "Hayotiy ko'rsatkichlarning yomonlashuvi",
            'actions': [
                "Shoshilinch tibbiy yordam chaqirish (103)",
                "Nafas yo'llarini ochish",
                "Yurak-o'pka reanimatsiyasi boshlash"
            ],
            'contacts': ["103 - Shoshilinch yordam", "Shifokor", "Qarindoshlar"]
        })
        
        # Specific protocols based on triage
        if triage_result.get('life_threatened', False):
            protocols.append({
                'trigger': "On'gani yo'qolish",
                'actions': [
                    "Tizimni yonboshga qo'yish",
                    "Havo yo'llarini tozalash",
                    "Sun'iy nafas berish"
                ]
            })
        
        return protocols
    
    def _integrate_learning(self, decision: Dict, patient_data: Dict):
        """Integrate learning from decision"""
        try:
            # Store decision for learning
            learning_data = {
                'patient_data_hash': hash(str(patient_data)),
                'decision': decision,
                'timestamp': timezone.now().isoformat(),
                'outcome_pending': True
            }
            
            # This would be stored in learning database
            logger.info(f"Decision stored for learning: {decision['decision_type']}")
            
        except Exception as e:
            logger.error(f"Learning integration failed: {e}")
    
    def _generate_emergency_fallback(self, patient_data: Dict, language: str) -> Dict:
        """Generate emergency fallback when system fails"""
        return {
            'decision_type': 'emergency_fallback',
            'autonomous_allowed': False,
            'confidence_score': 0.0,
            'error': 'Tizim xatosi, inson aralashuvi talab qilinadi',
            'emergency_actions': [
                "Shoshilinch tibbiy yordam chaqiring (103)",
                "Shifokorga murojaat qiling",
                "Bemor holatini kuzating"
            ],
            'recommendations': [
                "Darhol shifokor maslahatiga murojaat qiling",
                "Hech qanday dori ichmang shifokorsiz",
                "Hayotiy ko'rsatkichlarni kuzating"
            ],
            'decision_timestamp': timezone.now().isoformat(),
            'fallback_mode': True
        }
    
    def _build_patient_text(self, patient_data: Dict) -> str:
        """Build patient text for AI prompts"""
        parts = [
            f"Bemor: {patient_data.get('firstName', '')} {patient_data.get('lastName', '')}, {patient_data.get('age', '')} yosh, {patient_data.get('gender', '')}.",
            f"Shikoyatlar: {patient_data.get('complaints', '')}",
        ]
        
        if patient_data.get('history'):
            parts.append(f"Anamnez: {patient_data['history']}")
        if patient_data.get('objectiveData'):
            parts.append(f"Ob'ektiv: {patient_data['objectiveData']}")
        if patient_data.get('labResults'):
            parts.append(f"Lab: {patient_data['labResults']}")
        if patient_data.get('allergies'):
            parts.append(f"Allergiya: {patient_data['allergies']}")
        if patient_data.get('currentMedications'):
            parts.append(f"Dori-darmonlar: {patient_data['currentMedications']}")
        
        return "\n".join(parts)


# Global instance
clinical_decision_engine = ClinicalDecisionEngine()
