"""
Self-Learning System for Treatment Protocol Improvement
Continuously learns from outcomes and improves protocols
"""
import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from django.utils import timezone
from django.conf import settings

# ProtocolOutcome endi models.py da (makemigrations faqat models.py ni ko'radi).
# Eski `from .self_learning_system import ProtocolOutcome` importlari buzilmasin.
from .models import ProtocolOutcome

logger = logging.getLogger(__name__)

# Agregatsiya uchun bir marta o'qiladigan qatorlar chegarasi (xotira uchun)
_AGG_ROW_LIMIT = 2000
# Bitta guruh (masalan bitta simptom) statistikaga kirishi uchun minimal holat soni
_MIN_GROUP_CASES = 3


def stable_patient_hash(patient_data: Dict) -> str:
    """Bemor ma'lumotlaridan BARQAROR kalit (sha256).

    Python'ning hash(str) i har process'da tasodifiylashtiriladi (PYTHONHASHSEED),
    shuning uchun u restart'dan keyin hech qachon mos kelmasdi. Kanonik JSON
    (sort_keys) + sha256 esa har doim bir xil natija beradi.
    """
    try:
        canonical = json.dumps(patient_data or {}, sort_keys=True,
                               ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        canonical = repr(patient_data)
    return hashlib.sha256(canonical.encode('utf-8', errors='ignore')).hexdigest()


def _rate(successes: int, cases: int) -> Dict:
    return {
        'cases': cases,
        'successes': successes,
        'success_rate': round(successes / cases, 3) if cases else 0.0,
    }


class SelfLearningSystem:
    """Advanced self-learning system for protocol optimization"""
    
    def __init__(self):
        self.learning_thresholds = {
            'min_cases_for_learning': 10,
            'success_rate_threshold': 0.8,
            'safety_threshold': 0.9,
            'pattern_confidence_threshold': 0.7
        }
        self.pattern_cache = {}
        self.success_patterns = {}
        self.failure_patterns = {}
    
    def analyze_protocol_outcome(self, protocol_id: str, patient_data: Dict, 
                                outcome_data: Dict) -> Dict:
        """
        Analyze protocol outcome and update learning system
        
        Args:
            protocol_id: Unique protocol identifier
            patient_data: Original patient data
            outcome_data: Treatment outcome data
            
        Returns:
            Analysis results and learning insights
        """
        try:
            # Store outcome for learning
            outcome = self._store_outcome(protocol_id, patient_data, outcome_data)
            
            # Analyze patterns
            pattern_analysis = self._analyze_patterns(patient_data, outcome_data)
            
            # Update success/failure patterns
            self._update_pattern_database(patient_data, outcome_data, pattern_analysis)
            
            # Generate learning insights
            insights = self._generate_learning_insights(pattern_analysis)
            
            # Update protocol recommendations
            updated_recommendations = self._update_recommendations(insights)
            
            return {
                'outcome_stored': True,
                'pattern_analysis': pattern_analysis,
                'learning_insights': insights,
                'updated_recommendations': updated_recommendations,
                'learning_confidence': self._calculate_learning_confidence()
            }
            
        except Exception as e:
            logger.error(f"Error in outcome analysis: {e}")
            return {'error': str(e)}
    
    def get_improved_protocol_template(self, patient_data: Dict, 
                                     base_protocol: Dict) -> Dict:
        """
        Get improved protocol template based on learning
        
        Args:
            patient_data: Patient clinical data
            base_protocol: Base generated protocol
            
        Returns:
            Improved protocol with learning-based modifications
        """
        try:
            # Find similar successful cases
            similar_successful = self._find_similar_successful_cases(patient_data)
            
            # Extract improvement patterns
            improvements = self._extract_improvement_patterns(similar_successful)
            
            # Apply improvements to base protocol
            improved_protocol = self._apply_improvements(base_protocol, improvements)
            
            # Add learning confidence
            improved_protocol['learning_confidence'] = self._calculate_learning_confidence()
            improved_protocol['similar_cases_used'] = len(similar_successful)
            improved_protocol['learning_improvements_applied'] = True
            
            return improved_protocol
            
        except Exception as e:
            logger.error(f"Error in protocol improvement: {e}")
            return base_protocol
    
    def _store_outcome(self, protocol_id: str, patient_data: Dict, 
                      outcome_data: Dict) -> ProtocolOutcome:
        """Store outcome in database"""
        # Barqaror kalit — process restart'idan keyin ham bir xil (hash() emas!)
        patient_data_hash = stable_patient_hash(patient_data)

        outcome = ProtocolOutcome.objects.update_or_create(
            protocol_id=protocol_id,
            patient_data_hash=patient_data_hash,
            defaults={
                'protocol_details': outcome_data.get('protocol_details', {}),
                'patient_snapshot': self._patient_snapshot(patient_data),
                'treatment_success': outcome_data.get('treatment_success'),
                'patient_satisfaction': outcome_data.get('patient_satisfaction'),
                'complication_occurred': outcome_data.get('complication_occurred', False),
                'complication_details': outcome_data.get('complication_details', ''),
                'recovery_time_days': outcome_data.get('recovery_time_days'),
                'follow_up_required': outcome_data.get('follow_up_required', True)
            }
        )[0]
        
        # Calculate scores
        outcome.calculate_scores()
        
        return outcome
    
    def _patient_snapshot(self, patient_data: Dict) -> Dict:
        """Agregatsiya uchun kerakli minimal kesim (shaxsni aniqlovchi maydonlarsiz)."""
        try:
            age = int(patient_data.get('age') or 0)
        except (TypeError, ValueError):
            age = 0
        return {
            'age_band': self._age_band(age),
            'gender': str(patient_data.get('gender') or '').strip().lower(),
            'symptoms': self._extract_key_symptoms(
                str(patient_data.get('complaints') or '').lower()
            ),
        }

    @staticmethod
    def _age_band(age: int) -> str:
        if age <= 0:
            return 'unknown'
        if age < 18:
            return 'pediatric'
        if age >= 65:
            return 'geriatric'
        return 'adult'

    def _recent_outcomes(self) -> List[ProtocolOutcome]:
        """Agregatsiya uchun oxirgi natijalar (cheklangan)."""
        return list(
            ProtocolOutcome.objects
            .order_by('-created_at')[:_AGG_ROW_LIMIT]
        )

    def _analyze_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Saqlangan BARCHA natijalar bo'yicha haqiqiy agregatsiya.

        Muhim: bu yerda joriy holatning bitta qiymati "statistika" ko'rinishida
        qaytarilmaydi. Baza yetarli emas bo'lsa — status='insufficient_data'
        ochiq belgilanadi va guruhlar bo'sh qoladi.
        """
        min_cases = self.learning_thresholds['min_cases_for_learning']
        try:
            rows = self._recent_outcomes()
        except Exception as exc:
            logger.warning("Pattern aggregation: DB unavailable: %s", exc)
            return self._insufficient_patterns(0, min_cases,
                                               reason='database_unavailable')

        if len(rows) < min_cases:
            return self._insufficient_patterns(len(rows), min_cases)

        return {
            'status': 'ok',
            'cases_analyzed': len(rows),
            'cases_required': min_cases,
            'min_group_cases': _MIN_GROUP_CASES,
            'demographic_patterns': self._aggregate_demographics(rows),
            'symptom_patterns': self._aggregate_symptoms(rows),
            'treatment_patterns': self._aggregate_treatments(rows),
            'outcome_patterns': self._aggregate_outcomes(rows),
        }

    @staticmethod
    def _insufficient_patterns(seen: int, required: int,
                               reason: str = 'not_enough_cases') -> Dict:
        """Agregatsiya uchun ma'lumot yetarli emas — buni YASHIRMAYMIZ."""
        return {
            'status': 'insufficient_data',
            'reason': reason,
            'cases_analyzed': seen,
            'cases_required': required,
            'note': (
                f"Statistik xulosa uchun kamida {required} ta yakunlangan holat "
                f"kerak; hozir {seen} ta. Naqsh tahlili o'tkazilmadi."
            ),
            'demographic_patterns': {},
            'symptom_patterns': {},
            'treatment_patterns': {},
            'outcome_patterns': {},
        }

    @staticmethod
    def _tally(buckets: Dict[str, List[int]], key: str, success: bool):
        if not key:
            return
        slot = buckets.setdefault(key, [0, 0])   # [cases, successes]
        slot[0] += 1
        if success:
            slot[1] += 1

    @staticmethod
    def _finalize(buckets: Dict[str, List[int]]) -> Dict:
        """Shovqinni kesish: _MIN_GROUP_CASES dan kam guruhlar chiqarib tashlanadi."""
        return {
            key: _rate(succ, cases)
            for key, (cases, succ) in buckets.items()
            if cases >= _MIN_GROUP_CASES
        }

    def _aggregate_demographics(self, rows: List[ProtocolOutcome]) -> Dict:
        age_buckets: Dict[str, List[int]] = {}
        gender_buckets: Dict[str, List[int]] = {}
        for row in rows:
            snap = row.patient_snapshot or {}
            success = row.treatment_success is True
            self._tally(age_buckets, str(snap.get('age_band') or 'unknown'), success)
            self._tally(gender_buckets, str(snap.get('gender') or ''), success)

        age_eff = self._finalize(age_buckets)
        risk = [
            f"{band}: muvaffaqiyat {stat['success_rate']:.0%} ({stat['cases']} holat)"
            for band, stat in sorted(age_eff.items())
            if stat['success_rate'] < self.learning_thresholds['success_rate_threshold']
        ]
        return {
            'age_effectiveness': age_eff,
            'gender_effectiveness': self._finalize(gender_buckets),
            'demographic_risk_factors': risk,
        }

    def _aggregate_symptoms(self, rows: List[ProtocolOutcome]) -> Dict:
        buckets: Dict[str, List[int]] = {}
        combos: Dict[str, List[int]] = {}
        for row in rows:
            snap = row.patient_snapshot or {}
            success = row.treatment_success is True
            symptoms = [str(s) for s in (snap.get('symptoms') or []) if s]
            for symptom in symptoms:
                self._tally(buckets, symptom, success)
            if len(symptoms) >= 2:
                self._tally(combos, ' + '.join(sorted(symptoms)[:3]), success)

        effectiveness = self._finalize(buckets)
        threshold = self.learning_thresholds['success_rate_threshold']
        return {
            'symptom_effectiveness': effectiveness,
            'symptom_combinations': self._finalize(combos),
            'high_success_symptoms': sorted(
                s for s, st in effectiveness.items() if st['success_rate'] >= threshold
            ),
            'low_success_symptoms': sorted(
                s for s, st in effectiveness.items() if st['success_rate'] < threshold
            ),
        }

    def _aggregate_treatments(self, rows: List[ProtocolOutcome]) -> Dict:
        med_buckets: Dict[str, List[int]] = {}
        step_buckets: Dict[str, List[int]] = {}
        for row in rows:
            details = row.protocol_details or {}
            success = row.treatment_success is True
            for med in (details.get('medications') or []):
                if isinstance(med, dict):
                    self._tally(med_buckets, str(med.get('name') or '').strip(), success)
            plan = details.get('treatmentPlan') or details.get('treatment_plan') or []
            for i, _step in enumerate(plan):
                self._tally(step_buckets, f'step_{i}', success)

        return {
            'medication_effectiveness': self._finalize(med_buckets),
            'treatment_steps_effectiveness': self._finalize(step_buckets),
        }

    @staticmethod
    def _aggregate_outcomes(rows: List[ProtocolOutcome]) -> Dict:
        recovery = {'fast': 0, 'normal': 0, 'slow': 0, 'unknown': 0}
        satisfaction = {'high': 0, 'medium': 0, 'low': 0, 'unknown': 0}
        complications = 0
        for row in rows:
            days = row.recovery_time_days
            if days is None:
                recovery['unknown'] += 1
            elif days <= 3:
                recovery['fast'] += 1
            elif days <= 7:
                recovery['normal'] += 1
            else:
                recovery['slow'] += 1

            sat = row.patient_satisfaction
            if sat is None:
                satisfaction['unknown'] += 1
            elif sat >= 8:
                satisfaction['high'] += 1
            elif sat >= 6:
                satisfaction['medium'] += 1
            else:
                satisfaction['low'] += 1

            if row.complication_occurred:
                complications += 1

        total = len(rows)
        return {
            'recovery_time_patterns': recovery,
            'satisfaction_patterns': satisfaction,
            'complication_patterns': {
                'cases': total,
                'occurred': complications,
                'rate': round(complications / total, 3) if total else 0.0,
            },
        }

    def _update_pattern_database(self, patient_data: Dict, outcome_data: Dict, 
                                pattern_analysis: Dict):
        """Update pattern database with new insights"""
        success = outcome_data.get('treatment_success', False)
        
        if success:
            self._update_success_patterns(patient_data, pattern_analysis)
        else:
            self._update_failure_patterns(patient_data, pattern_analysis)
    
    def _update_success_patterns(self, patient_data: Dict, patterns: Dict):
        """Update success pattern database"""
        # Add to success patterns
        complaint_key = patient_data.get('complaints', '')[:50]
        
        if complaint_key not in self.success_patterns:
            self.success_patterns[complaint_key] = {
                'count': 0,
                'patterns': {},
                'effectiveness': 0.0
            }
        
        self.success_patterns[complaint_key]['count'] += 1
        self.success_patterns[complaint_key]['patterns'] = patterns
        self.success_patterns[complaint_key]['effectiveness'] = min(1.0, 
            self.success_patterns[complaint_key]['effectiveness'] + 0.1)
    
    def _update_failure_patterns(self, patient_data: Dict, patterns: Dict):
        """Update failure pattern database"""
        complaint_key = patient_data.get('complaints', '')[:50]
        
        if complaint_key not in self.failure_patterns:
            self.failure_patterns[complaint_key] = {
                'count': 0,
                'patterns': {},
                'risk_factors': []
            }
        
        self.failure_patterns[complaint_key]['count'] += 1
        self.failure_patterns[complaint_key]['patterns'] = patterns
    
    def _generate_learning_insights(self, pattern_analysis: Dict) -> Dict:
        """Generate learning insights from pattern analysis"""
        insights = {
            'status': pattern_analysis.get('status', 'insufficient_data'),
            'high_success_factors': [],
            'risk_factors': [],
            'optimization_opportunities': [],
            'confidence_level': 0.0
        }

        # Ma'lumot yetarli emas — hech qanday "xulosa" chiqarmaymiz
        if pattern_analysis.get('status') != 'ok':
            insights['note'] = pattern_analysis.get('note', '')
            return insights

        # Demografik xavf omillari (agregat)
        demo_patterns = pattern_analysis.get('demographic_patterns', {})
        insights['risk_factors'].extend(demo_patterns.get('demographic_risk_factors', []))

        # Simptom bo'yicha agregat
        symptom_patterns = pattern_analysis.get('symptom_patterns', {})
        insights['high_success_factors'].extend(symptom_patterns.get('high_success_symptoms', []))
        insights['risk_factors'].extend(symptom_patterns.get('low_success_symptoms', []))

        # Past samarali dorilar — optimallashtirish imkoniyati
        med_eff = (pattern_analysis.get('treatment_patterns') or {}).get('medication_effectiveness', {})
        threshold = self.learning_thresholds['success_rate_threshold']
        insights['optimization_opportunities'].extend(
            f"{name}: muvaffaqiyat {stat['success_rate']:.0%} ({stat['cases']} holat)"
            for name, stat in sorted(med_eff.items())
            if stat.get('success_rate', 0.0) < threshold
        )

        # Ishonch darajasi — tahlil qilingan holatlar soniga bog'liq (100 holat = 1.0)
        cases = int(pattern_analysis.get('cases_analyzed') or 0)
        insights['cases_analyzed'] = cases
        insights['confidence_level'] = round(min(1.0, cases / 100.0), 3)

        return insights
    
    def _update_recommendations(self, insights: Dict) -> Dict:
        """Update protocol recommendations based on insights"""
        recommendations = {
            'medication_adjustments': [],
            'monitoring_changes': [],
            'treatment_modifications': [],
            'precautionary_measures': []
        }
        
        # Generate recommendations based on insights
        high_success_factors = insights.get('high_success_factors', [])
        risk_factors = insights.get('risk_factors', [])
        
        # Medication recommendations
        for factor in high_success_factors:
            recommendations['medication_adjustments'].append(
                f"Consider {factor}-friendly medication options"
            )
        
        # Monitoring recommendations
        for factor in risk_factors:
            recommendations['monitoring_changes'].append(
                f"Increased monitoring for {factor}"
            )
        
        return recommendations
    
    def _find_similar_successful_cases(self, patient_data: Dict) -> List[Dict]:
        """Find similar successful cases"""
        complaints = patient_data.get('complaints', '').lower()
        age = patient_data.get('age', 0)
        
        similar_cases = []
        
        # Search in success patterns
        for complaint_key, success_data in self.success_patterns.items():
            if any(word in complaints for word in complaint_key.split() if len(word) > 3):
                if success_data['effectiveness'] > 0.8:
                    similar_cases.append(success_data)
        
        return similar_cases[:5]  # Return top 5 similar cases
    
    def _extract_improvement_patterns(self, similar_cases: List[Dict]) -> Dict:
        """Extract improvement patterns from similar cases"""
        improvements = {
            'medication_optimizations': [],
            'treatment_enhancements': [],
            'monitoring_improvements': [],
            'success_factors': []
        }
        
        for case in similar_cases:
            patterns = case.get('patterns', {})
            
            # Extract medication patterns — qiymat endi agregat: {cases, success_rate}
            med_patterns = patterns.get('treatment_patterns', {}).get('medication_effectiveness', {})
            threshold = self.learning_thresholds['success_rate_threshold']
            for med, stat in med_patterns.items():
                if isinstance(stat, dict):
                    if stat.get('success_rate', 0.0) >= threshold:
                        improvements['medication_optimizations'].append(med)
                elif stat:  # eski format (bool)
                    improvements['medication_optimizations'].append(med)
            
            # Extract success factors
            symptom_patterns = patterns.get('symptom_patterns', {})
            high_success = symptom_patterns.get('high_success_symptoms', [])
            improvements['success_factors'].extend(high_success)
        
        # Remove duplicates
        for key in improvements:
            improvements[key] = list(set(improvements[key]))
        
        return improvements
    
    def _apply_improvements(self, base_protocol: Dict, improvements: Dict) -> Dict:
        """Apply improvements to base protocol"""
        improved_protocol = base_protocol.copy()
        
        # Apply medication optimizations
        if 'medications' in improved_protocol:
            optimized_meds = improvements.get('medication_optimizations', [])
            for med in improved_protocol['medications']:
                if med.get('name') in optimized_meds:
                    med['learning_optimized'] = True
                    med['confidence_boost'] = 0.1
        
        # Add success factors to notes
        success_factors = improvements.get('success_factors', [])
        if success_factors:
            if 'notes' not in improved_protocol:
                improved_protocol['notes'] = []
            improved_protocol['notes'].append(
                f"Learning-based success factors: {', '.join(success_factors)}"
            )
        
        return improved_protocol
    
    def _calculate_learning_confidence(self) -> float:
        """Ishonch darajasi — BAZADAGI yakunlangan holatlar bo'yicha.

        Ilgari process xotirasidagi lug'atlardan hisoblanardi: har restart'da
        nolga tushar va workerlar orasida turlicha bo'lardi.
        """
        try:
            total_cases = ProtocolOutcome.objects.exclude(
                treatment_success__isnull=True
            ).count()
            total_success_cases = ProtocolOutcome.objects.filter(
                treatment_success=True
            ).count()
        except Exception as exc:
            logger.warning("Learning confidence: DB unavailable: %s", exc)
            return 0.0

        if total_cases < self.learning_thresholds['min_cases_for_learning']:
            return 0.0

        success_rate = total_success_cases / total_cases if total_cases > 0 else 0.0

        return round(min(1.0, success_rate * (total_cases / 100.0)), 3)
    
    def _extract_key_symptoms(self, complaints: str) -> List[str]:
        """Extract key symptoms from complaints"""
        # Simple keyword extraction - can be enhanced with NLP
        symptom_keywords = [
            'og\'riq', 'qayt', 'isitma', 'yo\'tal', 'bosh og\'riq', 'qorin og\'riq',
            'nafas qisilishi', 'shish', 'terlama', 'holsizlik', 'ish tuxishi'
        ]
        
        found_symptoms = []
        for keyword in symptom_keywords:
            if keyword in complaints:
                found_symptoms.append(keyword)
        
        return found_symptoms


# Global instance
self_learning_system = SelfLearningSystem()