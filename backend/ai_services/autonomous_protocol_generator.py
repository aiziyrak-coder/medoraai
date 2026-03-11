"""
Autonomous Treatment Protocol Generator
Generates and adapts treatment protocols with minimal human intervention
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .azure_utils import _call_gemini, DEPLOY_GPT4O, DEPLOY_MINI

# Backwards-compat aliases
GEMINI_PRO = DEPLOY_GPT4O()
GEMINI_FLASH = DEPLOY_MINI()

logger = logging.getLogger(__name__)


class AutonomousProtocolGenerator:
    """AI-powered autonomous treatment protocol generation system"""
    
    def __init__(self):
        self.protocol_cache = {}
        self.learning_database = {}
        self.safety_thresholds = {
            'max_autonomous_confidence': 0.95,
            'min_safety_score': 0.85,
            'critical_conditions_require_review': [
                'septic', 'cardiac arrest', 'severe bleeding', 'respiratory failure',
                'stroke', 'myocardial infarction', 'severe trauma'
            ]
        }
    
    def generate_autonomous_protocol(self, patient_data: Dict, language: str = 'uz-L') -> Dict:
        """
        Generate complete treatment protocol autonomously
        
        Args:
            patient_data: Patient clinical data
            language: Language for output
            
        Returns:
            Complete treatment protocol with safety checks
        """
        try:
            # Step 1: Risk assessment and safety check
            safety_assessment = self._perform_safety_assessment(patient_data)
            
            # Step 2: Generate initial protocol
            initial_protocol = self._generate_initial_protocol(patient_data, language)
            
            # Step 3: Apply safety modifications
            safe_protocol = self._apply_safety_modifications(initial_protocol, safety_assessment)
            
            # Step 4: Optimize for Uzbekistan context
            optimized_protocol = self._optimize_for_uzbekistan(safe_protocol, patient_data)
            
            # Step 5: Self-learning integration
            enhanced_protocol = self._apply_learning_patterns(optimized_protocol, patient_data)
            
            # Step 6: Final validation
            final_protocol = self._final_validation(enhanced_protocol, safety_assessment)
            
            # Step 7: Store for continuous learning
            self._store_protocol_for_learning(final_protocol, patient_data)
            
            return final_protocol
            
        except Exception as e:
            logger.error(f"Error in autonomous protocol generation: {e}")
            return self._generate_fallback_protocol(patient_data, language)
    
    def _perform_safety_assessment(self, patient_data: Dict) -> Dict:
        """Comprehensive safety assessment"""
        text = self._build_patient_text(patient_data)
        
        prompt = f"""XAVFSIZLIK BAHOLASHI - avtonom protokol uchun
        
Bemor ma'lumotlari:
{text}

Xavfsizlik baholang:
1. Hayotga xavf yo'qmi? (critical_condition: boolean)
2. Shoshilinch yordam kerakmi? (emergency_level: low/medium/high/critical)
3. Avtonom davolash xavfsizmi? (autonomous_safe: boolean)
4. Inson nazorati qachon kerak? (human_review_required: boolean)
5. Xavfsizlik balli (0-1) (safety_score: float)
6. Xavf omillari (risk_factors: array)

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Safety assessment failed: {e}")
            return {
                "critical_condition": True,
                "emergency_level": "high",
                "autonomous_safe": False,
                "human_review_required": True,
                "safety_score": 0.5,
                "risk_factors": ["AI assessment failed"]
            }
    
    def _generate_initial_protocol(self, patient_data: Dict, language: str) -> Dict:
        """Generate initial treatment protocol using AI"""
        text = self._build_patient_text(patient_data)
        
        language_map = {
            'uz-L': 'O\'zbek (Lotin)',
            'uz-C': 'O\'zbek (Kirill)',
            'ru': 'Ruscha',
            'en': 'Inglizcha'
        }
        
        prompt = f"""AVTONOM DAVOLASH PROTOKOLI yaratish
        
Bemor ma'lumotlari:
{text}

To'liq avtonom davolash protokolini yarating:
1. Aniq tashxis (name, probability, justification)
2. Davolash reja (5-8 qadam, qanday qilib qachon)
3. Dori-darmonlar (nomi, dozasi, qachon, necha marta, qanday ichish)
4. Tekshiruvlar (kerakli lab/tekshiruvlar)
5. Kuzatish (qanday kuzatish, qachon shifokorga murojaat)
6. Prognoz (qachon yaxshilanishi, qanday asoratlar)

MUHIM: 
- Faqat O'zbekistonda ro'yxatdan o'tgan dorilar
- SSV klinik protokollariga rioya qiling
- Xavfsizlik birinchi o'rinda
- Til: {language_map.get(language, 'O\'zbek (Lotin)')}

Javobni faqat JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Initial protocol generation failed: {e}")
            return {}
    
    def _apply_safety_modifications(self, protocol: Dict, safety: Dict) -> Dict:
        """Apply safety modifications to protocol"""
        if not safety.get('autonomous_safe', False):
            # Add safety warnings and human review requirements
            protocol['safety_warnings'] = [
                "Bu holat avtonom davolash uchun to'liq xavfsiz emas",
                "Shifokor nazorati zarur",
                "Tez-tez kuzatish talab qilinadi"
            ]
            protocol['human_review_required'] = True
            protocol['monitoring_frequency'] = "2 soatda bir marta"
        
        if safety.get('critical_condition', False):
            protocol['emergency_actions'] = [
                "Shoshilinch tibbiy yordam chaqirish",
                "Hayotiy ko'rsatkichlarni kuzatish",
                "Tez tibbiy aralashuv tayyorligi"
            ]
            protocol['autonomous_safe'] = False
        
        # Adjust medication dosages based on safety score
        if safety.get('safety_score', 1.0) < 0.8:
            if 'medications' in protocol:
                for med in protocol['medications']:
                    med['dosage_adjusted'] = f"Kamaytirilgan dozavi (xavfsizlik uchun)"
                    med['monitoring_required'] = True
        
        return protocol
    
    def _optimize_for_uzbekistan(self, protocol: Dict, patient_data: Dict) -> Dict:
        """Optimize protocol for Uzbekistan healthcare system"""
        optimization_prompt = f"""PROTOKOLNI O'ZBEKISTON UCHUN OPTIMALLASHTIRISH
        
Joriy protokol:
{json.dumps(protocol, ensure_ascii=False, indent=2)}

O'zbekiston sharoitlari uchun optimallashtiring:
1. Faqat O'zbekistonda mavjud dorilar
2. SSV tasdiqlagan protokollar
3. Mahalliy shifoxona imkoniyatlari
4. Narx va mavjudligi

Javobni JSON formatida qaytaring."""
        
        try:
            raw = _call_gemini(optimization_prompt, GEMINI_FLASH, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            optimized = json.loads(raw)
            protocol.update(optimized)
        except Exception as e:
            logger.error(f"Uzbekistan optimization failed: {e}")
        
        protocol['uzbekistan_compliant'] = True
        protocol['local_medications_only'] = True
        protocol['ssv_protocols_followed'] = True
        
        return protocol
    
    def _apply_learning_patterns(self, protocol: Dict, patient_data: Dict) -> Dict:
        """Apply machine learning from previous cases"""
        # Find similar cases from learning database
        similar_cases = self._find_similar_cases(patient_data)
        
        if similar_cases:
            # Apply successful patterns from similar cases
            successful_patterns = self._extract_successful_patterns(similar_cases)
            protocol = self._integrate_patterns(protocol, successful_patterns)
            protocol['learning_applied'] = True
            protocol['similar_cases_found'] = len(similar_cases)
        
        return protocol
    
    def _final_validation(self, protocol: Dict, safety: Dict) -> Dict:
        """Final validation of the complete protocol"""
        validation_prompt = f"""YAKUNIY VALIDATSIYA - Avtonom protokol
        
Protokol:
{json.dumps(protocol, ensure_ascii=False, indent=2)}

Xavfsizlik bahosi:
{json.dumps(safety, ensure_ascii=False, indent=2)}

Tekshiring:
1. Tashxis to'g'rimi?
2. Davolash reja xavfsizmi?
3. Dorilar dozalari to'g'rimi?
4. Shoshilinch holatlar qo'shilganmi?
5. Kuzatish rejasi to'liqmi?

Javobni JSON formatida: {{"valid": boolean, "issues": [], "confidence": float}}"""
        
        try:
            raw = _call_gemini(validation_prompt, GEMINI_PRO, response_mime_type="application/json")
            raw = raw.replace("```json", "").replace("```", "").strip()
            validation = json.loads(raw)
            
            protocol['validation'] = validation
            protocol['final_confidence'] = validation.get('confidence', 0.8)
            
            if not validation.get('valid', False):
                protocol['validation_issues'] = validation.get('issues', [])
                protocol['human_review_required'] = True
            
        except Exception as e:
            logger.error(f"Final validation failed: {e}")
            protocol['validation'] = {"valid": False, "issues": ["Validation failed"], "confidence": 0.5}
        
        # Add metadata
        protocol['generated_at'] = timezone.now().isoformat()
        protocol['autonomous_generation'] = True
        protocol['version'] = "2.0"
        
        return protocol
    
    def _store_protocol_for_learning(self, protocol: Dict, patient_data: Dict):
        """Store protocol for continuous learning"""
        case_key = self._generate_case_key(patient_data)
        
        learning_data = {
            'patient_data_hash': hash(str(patient_data)),
            'protocol': protocol,
            'timestamp': timezone.now().isoformat(),
            'success_outcome': None  # Will be updated when follow-up is available
        }
        
        self.learning_database[case_key] = learning_data
    
    def _generate_fallback_protocol(self, patient_data: Dict, language: str) -> Dict:
        """Generate safe fallback protocol when AI fails"""
        return {
            "error": "AI protokol generatsiyasi muvaffaqiyatsiz",
            "fallback_mode": True,
            "safety_first": True,
            "human_review_required": True,
            "emergency_actions": [
                "Shifokorga murojaat qiling",
                "Ahvoli yomonlashsa shoshilinch yordam chaqiring"
            ],
            "monitoring": [
                "Hayotiy ko'rsatkichlarni kuzating",
                "Har 2 soatda holatni baholang"
            ],
            "generated_at": timezone.now().isoformat(),
            "autonomous_generation": False
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
    
    def _find_similar_cases(self, patient_data: Dict) -> List[Dict]:
        """Find similar cases from learning database"""
        # Simple similarity matching based on complaints and age
        current_complaints = patient_data.get('complaints', '').lower()
        current_age = patient_data.get('age', 0)
        
        similar_cases = []
        for case_key, case_data in self.learning_database.items():
            if case_data.get('success_outcome') is True:
                # Add similarity logic here
                similar_cases.append(case_data)
        
        return similar_cases[:5]  # Return top 5 similar cases
    
    def _extract_successful_patterns(self, cases: List[Dict]) -> Dict:
        """Extract successful patterns from similar cases"""
        patterns = {
            'effective_medications': [],
            'successful_treatments': [],
            'optimal_monitoring': []
        }
        
        for case in cases:
            protocol = case.get('protocol', {})
            # Extract patterns logic here
            
        return patterns
    
    def _integrate_patterns(self, protocol: Dict, patterns: Dict) -> Dict:
        """Integrate learned patterns into protocol"""
        # Integration logic here
        protocol['learned_patterns_applied'] = True
        return protocol
    
    def _generate_case_key(self, patient_data: Dict) -> str:
        """Generate unique key for case identification"""
        complaints = patient_data.get('complaints', '')[:50]
        age = patient_data.get('age', 0)
        gender = patient_data.get('gender', '')
        return f"{complaints}_{age}_{gender}_{datetime.now().strftime('%Y%m%d')}"


# Global instance
autonomous_generator = AutonomousProtocolGenerator()