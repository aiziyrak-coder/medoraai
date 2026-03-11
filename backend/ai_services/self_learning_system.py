"""
Self-Learning System for Treatment Protocol Improvement
Continuously learns from outcomes and improves protocols
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from django.db import models
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


class ProtocolOutcome(models.Model):
    """Track outcomes of autonomous protocols for learning"""
    
    protocol_id = models.CharField(max_length=255, verbose_name='Protokol ID')
    patient_data_hash = models.CharField(max_length=255, verbose_name='Bemor ma\'lumotlari xeshi')
    
    # Protocol details
    protocol_details = models.JSONField(default=dict, verbose_name='Protokol tafsilotlari')
    
    # Outcome tracking
    treatment_success = models.BooleanField(null=True, blank=True, verbose_name='Davolash muvaffaqiyati')
    patient_satisfaction = models.IntegerField(null=True, blank=True, verbose_name='Bemor qoniqishi (1-10)')
    complication_occurred = models.BooleanField(default=False, verbose_name='Asoratlar yuz bergan')
    complication_details = models.TextField(blank=True, verbose_name='Asorat tafsilotlari')
    
    # Time tracking
    recovery_time_days = models.IntegerField(null=True, blank=True, verbose_name='Tiklanish vaqti (kun)')
    follow_up_required = models.BooleanField(default=True, verbose_name='Keyingi kuzatuv kerak')
    
    # Learning metrics
    effectiveness_score = models.FloatField(default=0.0, verbose_name='Samaradorlik balli')
    safety_score = models.FloatField(default=0.0, verbose_name='Xavfsizlik balli')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Yangilangan sana')
    
    class Meta:
        verbose_name = 'Protokol natijasi'
        verbose_name_plural = 'Protokol natijalari'
        indexes = [
            models.Index(fields=['protocol_id'], name='po_protocol_id_idx'),
            models.Index(fields=['treatment_success'], name='po_success_idx'),
            models.Index(fields=['effectiveness_score'], name='po_effectiveness_idx'),
            models.Index(fields=['created_at'], name='po_created_at_idx'),
        ]
    
    def calculate_scores(self):
        """Calculate effectiveness and safety scores"""
        # Base scores
        effectiveness = 0.5
        safety = 0.5
        
        # Treatment success impact
        if self.treatment_success is True:
            effectiveness += 0.3
            safety += 0.2
        elif self.treatment_success is False:
            effectiveness -= 0.3
            safety -= 0.2
        
        # Complications impact
        if self.complication_occurred:
            effectiveness -= 0.2
            safety -= 0.4
        
        # Patient satisfaction impact
        if self.patient_satisfaction:
            satisfaction_factor = (self.patient_satisfaction - 5) / 5  # -1 to 1
            effectiveness += satisfaction_factor * 0.1
            safety += satisfaction_factor * 0.05
        
        # Recovery time impact (faster is better)
        if self.recovery_time_days:
            if self.recovery_time_days <= 3:
                effectiveness += 0.1
            elif self.recovery_time_days <= 7:
                effectiveness += 0.05
            elif self.recovery_time_days > 14:
                effectiveness -= 0.1
        
        # Normalize scores
        self.effectiveness_score = max(0.0, min(1.0, effectiveness))
        self.safety_score = max(0.0, min(1.0, safety))
        
        self.save()


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
        patient_data_hash = hash(str(patient_data))
        
        outcome = ProtocolOutcome.objects.update_or_create(
            protocol_id=protocol_id,
            patient_data_hash=patient_data_hash,
            defaults={
                'protocol_details': outcome_data.get('protocol_details', {}),
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
    
    def _analyze_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Analyze patterns in patient data and outcomes"""
        patterns = {
            'demographic_patterns': self._analyze_demographic_patterns(patient_data, outcome_data),
            'symptom_patterns': self._analyze_symptom_patterns(patient_data, outcome_data),
            'treatment_patterns': self._analyze_treatment_patterns(patient_data, outcome_data),
            'outcome_patterns': self._analyze_outcome_patterns(patient_data, outcome_data)
        }
        
        return patterns
    
    def _analyze_demographic_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Analyze demographic patterns"""
        age = patient_data.get('age', 0)
        gender = patient_data.get('gender', '')
        success = outcome_data.get('treatment_success', False)
        
        patterns = {
            'age_effectiveness': {},
            'gender_effectiveness': {},
            'demographic_risk_factors': []
        }
        
        # Age-based patterns
        if age < 18:
            patterns['age_effectiveness']['pediatric'] = success
        elif age >= 65:
            patterns['age_effectiveness']['geriatric'] = success
        else:
            patterns['age_effectiveness']['adult'] = success
        
        # Gender-based patterns
        if gender:
            patterns['gender_effectiveness'][gender] = success
        
        return patterns
    
    def _analyze_symptom_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Analyze symptom-based patterns"""
        complaints = patient_data.get('complaints', '').lower()
        success = outcome_data.get('treatment_success', False)
        
        # Extract key symptoms
        key_symptoms = self._extract_key_symptoms(complaints)
        
        patterns = {
            'symptom_effectiveness': {},
            'symptom_combinations': [],
            'high_success_symptoms': [],
            'low_success_symptoms': []
        }
        
        for symptom in key_symptoms:
            patterns['symptom_effectiveness'][symptom] = success
            
            if success:
                patterns['high_success_symptoms'].append(symptom)
            else:
                patterns['low_success_symptoms'].append(symptom)
        
        return patterns
    
    def _analyze_treatment_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Analyze treatment effectiveness patterns"""
        protocol_details = outcome_data.get('protocol_details', {})
        success = outcome_data.get('treatment_success', False)
        
        patterns = {
            'medication_effectiveness': {},
            'treatment_steps_effectiveness': {},
            'dosage_patterns': {},
            'timing_patterns': {}
        }
        
        # Analyze medications
        medications = protocol_details.get('medications', [])
        for med in medications:
            med_name = med.get('name', '')
            patterns['medication_effectiveness'][med_name] = success
        
        # Analyze treatment steps
        treatment_plan = protocol_details.get('treatmentPlan', [])
        for i, step in enumerate(treatment_plan):
            patterns['treatment_steps_effectiveness'][f'step_{i}'] = success
        
        return patterns
    
    def _analyze_outcome_patterns(self, patient_data: Dict, outcome_data: Dict) -> Dict:
        """Analyze outcome patterns"""
        recovery_time = outcome_data.get('recovery_time_days')
        satisfaction = outcome_data.get('patient_satisfaction')
        complications = outcome_data.get('complication_occurred', False)
        
        patterns = {
            'recovery_time_patterns': {},
            'satisfaction_patterns': {},
            'complication_patterns': {}
        }
        
        if recovery_time:
            if recovery_time <= 3:
                patterns['recovery_time_patterns']['fast'] = True
            elif recovery_time <= 7:
                patterns['recovery_time_patterns']['normal'] = True
            else:
                patterns['recovery_time_patterns']['slow'] = True
        
        if satisfaction:
            if satisfaction >= 8:
                patterns['satisfaction_patterns']['high'] = True
            elif satisfaction >= 6:
                patterns['satisfaction_patterns']['medium'] = True
            else:
                patterns['satisfaction_patterns']['low'] = True
        
        patterns['complication_patterns']['occurred'] = complications
        
        return patterns
    
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
            'high_success_factors': [],
            'risk_factors': [],
            'optimization_opportunities': [],
            'confidence_level': 0.0
        }
        
        # Analyze demographic patterns
        demo_patterns = pattern_analysis.get('demographic_patterns', {})
        
        # Analyze symptom patterns
        symptom_patterns = pattern_analysis.get('symptom_patterns', {})
        high_success_symptoms = symptom_patterns.get('high_success_symptoms', [])
        low_success_symptoms = symptom_patterns.get('low_success_symptoms', [])
        
        insights['high_success_factors'].extend(high_success_symptoms)
        insights['risk_factors'].extend(low_success_symptoms)
        
        # Calculate confidence
        total_patterns = sum(len(v) if isinstance(v, dict) else 1 for v in pattern_analysis.values())
        insights['confidence_level'] = min(1.0, total_patterns / 20.0)
        
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
            
            # Extract medication patterns
            med_patterns = patterns.get('treatment_patterns', {}).get('medication_effectiveness', {})
            for med, effective in med_patterns.items():
                if effective:
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
        """Calculate overall learning confidence"""
        total_success_cases = sum(data['count'] for data in self.success_patterns.values())
        total_failure_cases = sum(data['count'] for data in self.failure_patterns.values())
        total_cases = total_success_cases + total_failure_cases
        
        if total_cases < self.learning_thresholds['min_cases_for_learning']:
            return 0.0
        
        success_rate = total_success_cases / total_cases if total_cases > 0 else 0.0
        
        return min(1.0, success_rate * (total_cases / 100.0))
    
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