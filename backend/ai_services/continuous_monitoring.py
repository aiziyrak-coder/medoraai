"""
Continuous Monitoring and Adaptation System
Real-time monitoring of treatment protocols and automatic adaptation
"""
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from django.conf import settings
from django.utils import timezone
from django.db import models
try:
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    HAS_CHANNELS = True
except ImportError:
    HAS_CHANNELS = False
    get_channel_layer = None
    async_to_sync = None

from .azure_utils import _call_gemini, DEPLOY_GPT4O, DEPLOY_MINI

GEMINI_PRO = DEPLOY_GPT4O()
GEMINI_FLASH = DEPLOY_MINI()
from .clinical_decision_engine import clinical_decision_engine
from .self_learning_system import self_learning_system

logger = logging.getLogger(__name__)


class MonitoringSession(models.Model):
    """Active monitoring session for a patient"""
    
    session_id = models.CharField(max_length=255, unique=True, verbose_name='Sessiya ID')
    patient_data_hash = models.CharField(max_length=255, verbose_name="Bemor ma'lumotlari xeshi")
    
    # Protocol details
    protocol_id = models.CharField(max_length=255, verbose_name='Protokol ID')
    treatment_plan = models.JSONField(default=dict, verbose_name='Davolash reja')
    
    # Monitoring settings
    monitoring_frequency = models.IntegerField(default=3600, verbose_name='Monitoring chastotasi (sekund)')
    vital_signs_required = models.JSONField(default=list, verbose_name='Talab qilinadigan vital belgilar')
    alert_thresholds = models.JSONField(default=dict, verbose_name='Ogohlantirish chegaralari')
    
    # Session status
    active = models.BooleanField(default=True, verbose_name='Aktiv')
    last_check = models.DateTimeField(auto_now=True, verbose_name='Oxirgi tekshiruv')
    next_check = models.DateTimeField(verbose_name='Keyingi tekshiruv')
    
    # Outcomes
    alerts_triggered = models.JSONField(default=list, verbose_name='Ogohlantirishlar')
    adaptations_made = models.JSONField(default=list, verbose_name="O'zgarishlar")
    outcome_data = models.JSONField(default=dict, verbose_name="Natija ma'lumotlari")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Yangilangan sana')
    
    class Meta:
        verbose_name = 'Monitoring sessiyasi'
        verbose_name_plural = 'Monitoring sessiyalari'
        indexes = [
            models.Index(fields=['session_id'], name='ms_session_id_idx'),
            models.Index(fields=['active'], name='ms_active_idx'),
            models.Index(fields=['next_check'], name='ms_next_check_idx'),
            models.Index(fields=['protocol_id'], name='ms_protocol_id_idx'),
        ]
    
    def save(self, *args, **kwargs):
        if not self.next_check:
            self.next_check = timezone.now() + timedelta(seconds=self.monitoring_frequency)
        super().save(*args, **kwargs)


class VitalSignsReading(models.Model):
    """Individual vital signs reading"""
    
    session = models.ForeignKey(
        MonitoringSession,
        on_delete=models.CASCADE,
        related_name='vital_readings',
        verbose_name='Monitoring sessiyasi'
    )
    
    # Vital signs
    blood_pressure_systolic = models.IntegerField(null=True, blank=True, verbose_name='Qon bosimi sistola')
    blood_pressure_diastolic = models.IntegerField(null=True, blank=True, verbose_name='Qon bosimi diastola')
    heart_rate = models.IntegerField(null=True, blank=True, verbose_name='Yurak urishi')
    respiratory_rate = models.IntegerField(null=True, blank=True, verbose_name='Nafas soni')
    temperature = models.FloatField(null=True, blank=True, verbose_name='Harorat')
    oxygen_saturation = models.FloatField(null=True, blank=True, verbose_name='SpO2')
    blood_glucose = models.FloatField(null=True, blank=True, verbose_name='Qon shakari')
    
    # Patient reported
    pain_level = models.IntegerField(null=True, blank=True, verbose_name="Og'riq darajasi (0-10)")
    symptoms = models.TextField(blank=True, verbose_name='Simptomlar')
    medication_taken = models.JSONField(default=list, verbose_name='Ichilgan dorilar')
    
    # System assessment
    status = models.CharField(
        max_length=20,
        choices=[
            ('normal', 'Normal'),
            ('attention', "E'tibor talab qiladi"),
            ('warning', 'Ogohlantirish'),
            ('critical', 'Kritik')
        ],
        default='normal',
        verbose_name='Holat'
    )
    
    alerts = models.JSONField(default=list, verbose_name='Ogohlantirishlar')
    recommendations = models.JSONField(default=list, verbose_name='Tavsiyalar')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Yaratilgan sana')
    
    class Meta:
        verbose_name = "Vital belgilar o'lchovi"
        verbose_name_plural = "Vital belgilar o'lchovlari"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', 'created_at'], name='vsr_session_created_idx'),
            models.Index(fields=['status'], name='vsr_status_idx'),
            models.Index(fields=['created_at'], name='vsr_created_at_idx'),
        ]


class ContinuousMonitoringSystem:
    """Advanced continuous monitoring and adaptation system"""
    
    def __init__(self):
        self.monitoring_thresholds = {
            'blood_pressure': {
                'critical_high': {'systolic': 180, 'diastolic': 120},
                'warning_high': {'systolic': 160, 'diastolic': 100},
                'warning_low': {'systolic': 90, 'diastolic': 60},
                'critical_low': {'systolic': 80, 'diastolic': 50}
            },
            'heart_rate': {
                'critical_high': 120,
                'warning_high': 100,
                'warning_low': 50,
                'critical_low': 40
            },
            'temperature': {
                'critical_high': 39.5,
                'warning_high': 38.5,
                'warning_low': 35.5,
                'critical_low': 34.0
            },
            'oxygen_saturation': {
                'critical_low': 88,
                'warning_low': 92,
                'normal_low': 95
            },
            'respiratory_rate': {
                'critical_high': 30,
                'warning_high': 24,
                'warning_low': 10,
                'critical_low': 8
            }
        }
        
        self.adaptation_rules = {
            'blood_pressure_elevation': self._adapt_for_bp_elevation,
            'fever': self._adapt_for_fever,
            'hypoxia': self._adapt_for_hypoxia,
            'pain_increase': self._adapt_for_pain_increase,
            'medication_non_compliance': self._adapt_for_non_compliance
        }
    
    def start_monitoring_session(self, protocol_id: str, patient_data: Dict, 
                                treatment_plan: Dict) -> str:
        """
        Start a new monitoring session
        
        Args:
            protocol_id: Unique protocol identifier
            patient_data: Patient clinical data
            treatment_plan: Treatment protocol
            
        Returns:
            Session ID for tracking
        """
        try:
            # Generate unique session ID
            session_id = f"session_{protocol_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
            patient_data_hash = hash(str(patient_data))
            
            # Determine monitoring frequency based on risk
            risk_level = self._assess_monitoring_risk(patient_data, treatment_plan)
            frequency = self._get_monitoring_frequency(risk_level)
            
            # Set vital signs to monitor
            vital_signs = self._determine_vital_signs(treatment_plan)
            
            # Set alert thresholds
            thresholds = self._set_alert_thresholds(patient_data, treatment_plan)
            
            # Create monitoring session
            session = MonitoringSession.objects.create(
                session_id=session_id,
                patient_data_hash=patient_data_hash,
                protocol_id=protocol_id,
                treatment_plan=treatment_plan,
                monitoring_frequency=frequency,
                vital_signs_required=vital_signs,
                alert_thresholds=thresholds,
                next_check=timezone.now() + timedelta(seconds=frequency)
            )
            
            logger.info(f"Started monitoring session: {session_id}")
            
            # Send notification to frontend
            self._send_monitoring_notification(session_id, 'started', {
                'frequency': frequency,
                'vital_signs': vital_signs,
                'next_check': session.next_check.isoformat()
            })
            
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to start monitoring session: {e}")
            raise
    
    def record_vital_signs(self, session_id: str, vital_data: Dict) -> Dict:
        """
        Record vital signs and perform analysis
        
        Args:
            session_id: Monitoring session ID
            vital_data: Vital signs data
            
        Returns:
            Analysis results and recommendations
        """
        try:
            # Get monitoring session
            session = MonitoringSession.objects.get(session_id=session_id, active=True)
            
            # Create vital signs reading
            reading = VitalSignsReading.objects.create(
                session=session,
                blood_pressure_systolic=vital_data.get('blood_pressure_systolic'),
                blood_pressure_diastolic=vital_data.get('blood_pressure_diastolic'),
                heart_rate=vital_data.get('heart_rate'),
                respiratory_rate=vital_data.get('respiratory_rate'),
                temperature=vital_data.get('temperature'),
                oxygen_saturation=vital_data.get('oxygen_saturation'),
                blood_glucose=vital_data.get('blood_glucose'),
                pain_level=vital_data.get('pain_level'),
                symptoms=vital_data.get('symptoms', ''),
                medication_taken=vital_data.get('medication_taken', [])
            )
            
            # Analyze vital signs
            analysis = self._analyze_vital_signs(reading, session)
            
            # Update reading with analysis
            reading.status = analysis['status']
            reading.alerts = analysis['alerts']
            reading.recommendations = analysis['recommendations']
            reading.save()
            
            # Check for protocol adaptation
            adaptations = self._check_protocol_adaptation(reading, session)
            
            # Update session if adaptations made
            if adaptations:
                session.adaptations_made.extend(adaptations)
                session.save()
            
            # Send real-time notification
            self._send_vital_signs_notification(session_id, reading, analysis)
            
            # Schedule next check
            self._schedule_next_check(session, analysis['urgency'])
            
            return {
                'reading_id': reading.id,
                'status': analysis['status'],
                'alerts': analysis['alerts'],
                'recommendations': analysis['recommendations'],
                'adaptations': adaptations,
                'next_check': session.next_check.isoformat()
            }
            
        except MonitoringSession.DoesNotExist:
            logger.error(f"Monitoring session not found: {session_id}")
            return {'error': 'Session not found'}
        except Exception as e:
            logger.error(f"Error recording vital signs: {e}")
            return {'error': str(e)}
    
    def _analyze_vital_signs(self, reading: VitalSignsReading, session: MonitoringSession) -> Dict:
        """Analyze vital signs for abnormalities"""
        alerts = []
        recommendations = []
        status = 'normal'
        urgency = 'low'
        
        # Blood pressure analysis
        if reading.blood_pressure_systolic and reading.blood_pressure_diastolic:
            bp_analysis = self._analyze_blood_pressure(
                reading.blood_pressure_systolic,
                reading.blood_pressure_diastolic,
                session.alert_thresholds.get('blood_pressure', {})
            )
            alerts.extend(bp_analysis['alerts'])
            recommendations.extend(bp_analysis['recommendations'])
            if bp_analysis['urgency'] > urgency:
                urgency = bp_analysis['urgency']
        
        # Heart rate analysis
        if reading.heart_rate:
            hr_analysis = self._analyze_heart_rate(
                reading.heart_rate,
                session.alert_thresholds.get('heart_rate', {})
            )
            alerts.extend(hr_analysis['alerts'])
            recommendations.extend(hr_analysis['recommendations'])
            if hr_analysis['urgency'] > urgency:
                urgency = hr_analysis['urgency']
        
        # Temperature analysis
        if reading.temperature:
            temp_analysis = self._analyze_temperature(
                reading.temperature,
                session.alert_thresholds.get('temperature', {})
            )
            alerts.extend(temp_analysis['alerts'])
            recommendations.extend(temp_analysis['recommendations'])
            if temp_analysis['urgency'] > urgency:
                urgency = temp_analysis['urgency']
        
        # Oxygen saturation analysis
        if reading.oxygen_saturation:
            o2_analysis = self._analyze_oxygen_saturation(
                reading.oxygen_saturation,
                session.alert_thresholds.get('oxygen_saturation', {})
            )
            alerts.extend(o2_analysis['alerts'])
            recommendations.extend(o2_analysis['recommendations'])
            if o2_analysis['urgency'] > urgency:
                urgency = o2_analysis['urgency']
        
        # Pain level analysis
        if reading.pain_level is not None:
            pain_analysis = self._analyze_pain_level(reading.pain_level)
            alerts.extend(pain_analysis['alerts'])
            recommendations.extend(pain_analysis['recommendations'])
            if pain_analysis['urgency'] > urgency:
                urgency = pain_analysis['urgency']
        
        # Symptoms analysis
        if reading.symptoms:
            symptom_analysis = self._analyze_symptoms(reading.symptoms)
            alerts.extend(symptom_analysis['alerts'])
            recommendations.extend(symptom_analysis['recommendations'])
            if symptom_analysis['urgency'] > urgency:
                urgency = symptom_analysis['urgency']
        
        # Determine overall status
        if urgency == 'critical':
            status = 'critical'
        elif urgency == 'high':
            status = 'warning'
        elif urgency == 'medium':
            status = 'attention'
        else:
            status = 'normal'
        
        return {
            'status': status,
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency,
            'analysis_timestamp': timezone.now().isoformat()
        }
    
    def _analyze_blood_pressure(self, systolic: int, diastolic: int, thresholds: Dict) -> Dict:
        """Analyze blood pressure readings"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        if not thresholds:
            thresholds = self.monitoring_thresholds['blood_pressure']
        
        # Check critical high
        if systolic >= thresholds['critical_high']['systolic'] or diastolic >= thresholds['critical_high']['diastola']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik yuqori qon bosimi: {systolic}/{diastolic}',
                'value': f'{systolic}/{diastolic}',
                'threshold': f">{thresholds['critical_high']['systolic']}/{thresholds['critical_high']['diastola']}"
            })
            recommendations.append('Darhol shifokorga murojaat qiling')
            recommendations.append('Shoshilinch tibbiy yordam chaqiring (103)')
            urgency = 'critical'
        
        # Check warning high
        elif systolic >= thresholds['warning_high']['systolic'] or diastolic >= thresholds['warning_high']['diastola']:
            alerts.append({
                'type': 'warning',
                'message': f'Yuqori qon bosimi: {systolic}/{diastolic}',
                'value': f'{systolic}/{diastolic}',
                'threshold': f">{thresholds['warning_high']['systolic']}/{thresholds['warning_high']['diastola']}"
            })
            recommendations.append("Qon bosimini 2 soatdan so'ng qayta o'lchang")
            recommendations.append('Shifokor bilan maslahatlashing')
            urgency = 'high'
        
        # Check critical low
        elif systolic <= thresholds['critical_low']['systolic'] or diastolic <= thresholds['critical_low']['diastola']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik past qon bosimi: {systolic}/{diastolic}',
                'value': f'{systolic}/{diastolic}',
                'threshold': f"<{thresholds['critical_low']['systolic']}/{thresholds['critical_low']['diastola']}"
            })
            recommendations.append("Yotqazing va oyoqlarni ko'taring")
            recommendations.append('Suyuqlik iching')
            recommendations.append('Darhol shifokorga murojaat qiling')
            urgency = 'critical'
        
        # Check warning low
        elif systolic <= thresholds['warning_low']['systolic'] or diastolic <= thresholds['warning_low']['diastola']:
            alerts.append({
                'type': 'warning',
                'message': f'Past qon bosimi: {systolic}/{diastolic}',
                'value': f'{systolic}/{diastolic}',
                'threshold': f"<{thresholds['warning_low']['systolic']}/{thresholds['warning_low']['diastola']}"
            })
            recommendations.append("Qon bosimini 1 soatdan so'ng qayta o'lchang")
            recommendations.append("Ko'proq suyuqlik iching")
            urgency = 'medium'
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _analyze_heart_rate(self, heart_rate: int, thresholds: Dict) -> Dict:
        """Analyze heart rate"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        if not thresholds:
            thresholds = self.monitoring_thresholds['heart_rate']
        
        if heart_rate >= thresholds['critical_high']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik yuqori yurak urishi: {heart_rate}',
                'value': str(heart_rate),
                'threshold': f">{thresholds['critical_high']}"
            })
            recommendations.append('Darhol shifokorga murojaat qiling')
            urgency = 'critical'
        elif heart_rate >= thresholds['warning_high']:
            alerts.append({
                'type': 'warning',
                'message': f'Yuqori yurak urishi: {heart_rate}',
                'value': str(heart_rate),
                'threshold': f">{thresholds['warning_high']}"
            })
            recommendations.append("Tinchlaning va 15 daqiqadan so'ng qayta o'lchang")
            urgency = 'medium'
        elif heart_rate <= thresholds['critical_low']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik past yurak urishi: {heart_rate}',
                'value': str(heart_rate),
                'threshold': f"<{thresholds['critical_low']}"
            })
            recommendations.append('Darhol shifokorga murojaat qiling')
            urgency = 'critical'
        elif heart_rate <= thresholds['warning_low']:
            alerts.append({
                'type': 'warning',
                'message': f'Past yurak urishi: {heart_rate}',
                'value': str(heart_rate),
                'threshold': f"<{thresholds['warning_low']}"
            })
            recommendations.append('Faollikni kamaytiring')
            urgency = 'medium'
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _analyze_temperature(self, temperature: float, thresholds: Dict) -> Dict:
        """Analyze body temperature"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        if not thresholds:
            thresholds = self.monitoring_thresholds['temperature']
        
        if temperature >= thresholds['critical_high']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik yuqori harorat: {temperature}°C',
                'value': str(temperature),
                'threshold': f">{thresholds['critical_high']}°C"
            })
            recommendations.append('Darhol shifokorga murojaat qiling')
            recommendations.append("Issiq suvli kompress qo'ying")
            urgency = 'critical'
        elif temperature >= thresholds['warning_high']:
            alerts.append({
                'type': 'warning',
                'message': f'Yuqori harorat: {temperature}°C',
                'value': str(temperature),
                'threshold': f">{thresholds['warning_high']}°C"
            })
            recommendations.append("Ko'proq suyuqlik iching")
            recommendations.append('Paratsetamol olish mumkin')
            urgency = 'medium'
        elif temperature <= thresholds['critical_low']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik past harorat: {temperature}°C',
                'value': str(temperature),
                'threshold': f"<{thresholds['critical_low']}°C"
            })
            recommendations.append("Isitib qo'ying")
            recommendations.append('Darhol shifokorga murojaat qiling')
            urgency = 'critical'
        elif temperature <= thresholds['warning_low']:
            alerts.append({
                'type': 'warning',
                'message': f'Past harorat: {temperature}°C',
                'value': str(temperature),
                'threshold': f"<{thresholds['warning_low']}°C"
            })
            recommendations.append('Issiq kiyinib oling')
            urgency = 'medium'
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _analyze_oxygen_saturation(self, saturation: float, thresholds: Dict) -> Dict:
        """Analyze oxygen saturation"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        if not thresholds:
            thresholds = self.monitoring_thresholds['oxygen_saturation']
        
        if saturation <= thresholds['critical_low']:
            alerts.append({
                'type': 'critical',
                'message': f'Kritik past kislorod: {saturation}%',
                'value': str(saturation),
                'threshold': f"<{thresholds['critical_low']}%"
            })
            recommendations.append('Darhol shoshilinch yordam chaqiring (103)')
            recommendations.append("O'tirib oling, yotmang")
            urgency = 'critical'
        elif saturation <= thresholds['warning_low']:
            alerts.append({
                'type': 'warning',
                'message': f'Past kislorod: {saturation}%',
                'value': str(saturation),
                'threshold': f"<{thresholds['warning_low']}%"
            })
            recommendations.append('Chuqur nafas oling')
            recommendations.append('Shifokorga murojaat qiling')
            urgency = 'high'
        elif saturation <= thresholds['normal_low']:
            alerts.append({
                'type': 'attention',
                'message': f'Kislorod past chegarada: {saturation}%',
                'value': str(saturation),
                'threshold': f"<{thresholds['normal_low']}%"
            })
            recommendations.append("30 daqiqadan so'ng qayta o'lchang")
            urgency = 'low'
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _analyze_pain_level(self, pain_level: int) -> Dict:
        """Analyze pain level"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        if pain_level >= 8:
            alerts.append({
                'type': 'critical',
                'message': f'Juda kuchli og\'riq: {pain_level}/10',
                'value': str(pain_level),
                'threshold': '>= 8/10'
            })
            recommendations.append('Darhol shifokorga murojaat qiling')
            recommendations.append("Og'riq qoldiruvchi olish mumkin")
            urgency = 'critical'
        elif pain_level >= 6:
            alerts.append({
                'type': 'warning',
                'message': f'Kuchli og\'riq: {pain_level}/10',
                'value': str(pain_level),
                'threshold': '>= 6/10'
            })
            recommendations.append("Og'riq qoldiruvchi oling")
            recommendations.append("1 soatdan so'ng qayta baholang")
            urgency = 'medium'
        elif pain_level >= 4:
            alerts.append({
                'type': 'attention',
                'message': f'O\'rtacha og\'riq: {pain_level}/10',
                'value': str(pain_level),
                'threshold': '>= 4/10'
            })
            recommendations.append('Dam oling')
            urgency = 'low'
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _analyze_symptoms(self, symptoms: str) -> Dict:
        """Analyze patient-reported symptoms"""
        alerts = []
        recommendations = []
        urgency = 'low'
        
        symptoms_lower = symptoms.lower()
        
        # Critical symptoms
        critical_symptoms = [
            'nafas qisilishi', 'ko\'krakda siqilish', 'on\'g\'ini yo\'qotish',
            'qon qusish', 'qon siydik', 'falaj', 'qattiq bosh og\'riq'
        ]
        
        for symptom in critical_symptoms:
            if symptom in symptoms_lower:
                alerts.append({
                    'type': 'critical',
                    'message': f'Xavfli simptom: {symptom}',
                    'value': symptom,
                    'threshold': 'Critical symptom'
                })
                recommendations.append('Darhol shoshilinch yordam chaqiring (103)')
                urgency = 'critical'
                break
        
        # Warning symptoms
        if urgency != 'critical':
            warning_symptoms = [
                'qayt', 'isitma', 'dizenteriya', 'bosh aylanishi',
                'holsizlik', 'ish tuxishi'
            ]
            
            for symptom in warning_symptoms:
                if symptom in symptoms_lower:
                    alerts.append({
                        'type': 'warning',
                        'message': f'E\'tibor talab qiladigan simptom: {symptom}',
                        'value': symptom,
                        'threshold': 'Warning symptom'
                    })
                    recommendations.append('Shifokor bilan maslahatlashing')
                    urgency = 'medium'
                    break
        
        return {
            'alerts': alerts,
            'recommendations': recommendations,
            'urgency': urgency
        }
    
    def _check_protocol_adaptation(self, reading: VitalSignsReading, session: MonitoringSession) -> List[Dict]:
        """Check if protocol adaptation is needed"""
        adaptations = []
        
        # Check each adaptation rule
        for rule_name, rule_function in self.adaptation_rules.items():
            try:
                adaptation = rule_function(reading, session)
                if adaptation:
                    adaptations.append(adaptation)
            except Exception as e:
                logger.error(f"Adaptation rule {rule_name} failed: {e}")
        
        return adaptations
    
    def _adapt_for_bp_elevation(self, reading: VitalSignsReading, session: MonitoringSession) -> Optional[Dict]:
        """Adapt protocol for blood pressure elevation"""
        if (reading.blood_pressure_systolic and reading.blood_pressure_diastolic and
            reading.blood_pressure_systolic >= 160 or reading.blood_pressure_diastolic >= 100):
            
            return {
                'type': 'medication_adjustment',
                'reason': 'Yuqori qon bosimi',
                'adaptation': 'Qon bosimini pasaytiruvchi dorini ko\'rib chiqish',
                'timestamp': timezone.now().isoformat()
            }
        return None
    
    def _adapt_for_fever(self, reading: VitalSignsReading, session: MonitoringSession) -> Optional[Dict]:
        """Adapt protocol for fever"""
        if reading.temperature and reading.temperature >= 38.5:
            return {
                'type': 'medication_addition',
                'reason': 'Isitma',
                'adaptation': 'Haroratni pasaytiruvchi dori qo\'shish',
                'timestamp': timezone.now().isoformat()
            }
        return None
    
    def _adapt_for_hypoxia(self, reading: VitalSignsReading, session: MonitoringSession) -> Optional[Dict]:
        """Adapt protocol for hypoxia"""
        if reading.oxygen_saturation and reading.oxygen_saturation <= 92:
            return {
                'type': 'emergency_action',
                'reason': 'Past kislorod darajasi',
                'adaptation': 'Shoshilinch tibbiy yordam chaqirish',
                'timestamp': timezone.now().isoformat()
            }
        return None
    
    def _adapt_for_pain_increase(self, reading: VitalSignsReading, session: MonitoringSession) -> Optional[Dict]:
        """Adapt protocol for increased pain"""
        if reading.pain_level and reading.pain_level >= 6:
            return {
                'type': 'medication_adjustment',
                'reason': 'Kuchli og\'riq',
                'adaptation': 'Og\'riq qoldiruvchi dozasini ko\'rib chiqish',
                'timestamp': timezone.now().isoformat()
            }
        return None
    
    def _adapt_for_non_compliance(self, reading: VitalSignsReading, session: MonitoringSession) -> Optional[Dict]:
        """Adapt protocol for medication non-compliance"""
        # This would need more complex logic to detect non-compliance
        return None
    
    def _assess_monitoring_risk(self, patient_data: Dict, treatment_plan: Dict) -> str:
        """Assess risk level for monitoring frequency"""
        age = patient_data.get('age', 0)
        complaints = patient_data.get('complaints', '').lower()
        
        # High risk factors
        high_risk_factors = [
            'yurak', 'nafas qisilishi', 'qon bosimi', 'isitma', 'diabet',
            'astma', 'gipertenziya', 'yurak yetishmovchiligi'
        ]
        
        # Age risk
        if age >= 75 or age <= 5:
            return 'high'
        
        # Complaint risk
        for factor in high_risk_factors:
            if factor in complaints:
                return 'high'
        
        # Medium risk factors
        medium_risk_factors = [
            'og\'riq', 'yo\'tal', 'bosh og\'riq', 'shish', 'holsizlik'
        ]
        
        for factor in medium_risk_factors:
            if factor in complaints:
                return 'medium'
        
        return 'low'
    
    def _get_monitoring_frequency(self, risk_level: str) -> int:
        """Get monitoring frequency in seconds based on risk level"""
        frequencies = {
            'critical': 1800,  # 30 minutes
            'high': 3600,      # 1 hour
            'medium': 7200,    # 2 hours
            'low': 14400       # 4 hours
        }
        return frequencies.get(risk_level, 3600)
    
    def _determine_vital_signs(self, treatment_plan: Dict) -> List[str]:
        """Determine which vital signs to monitor"""
        vital_signs = ['blood_pressure', 'heart_rate', 'temperature']
        
        # Add oxygen saturation for respiratory conditions
        plan_text = str(treatment_plan).lower()
        if any(keyword in plan_text for keyword in ['nafas', 'o\'pka', 'astma', 'dem']):
            vital_signs.append('oxygen_saturation')
            vital_signs.append('respiratory_rate')
        
        # Add glucose for diabetic conditions
        if 'diabet' in plan_text or 'qon shakari' in plan_text:
            vital_signs.append('blood_glucose')
        
        return vital_signs
    
    def _set_alert_thresholds(self, patient_data: Dict, treatment_plan: Dict) -> Dict:
        """Set personalized alert thresholds"""
        age = patient_data.get('age', 0)
        
        # Start with default thresholds
        thresholds = self.monitoring_thresholds.copy()
        
        # Adjust for age
        if age >= 65:
            # Elderly patients may have different normal ranges
            thresholds['heart_rate']['warning_low'] = 50
            thresholds['heart_rate']['warning_high'] = 90
        elif age <= 12:
            # Pediatric patients
            thresholds['heart_rate']['warning_high'] = 120
            thresholds['heart_rate']['warning_low'] = 60
        
        return thresholds
    
    def _schedule_next_check(self, session: MonitoringSession, urgency: str):
        """Schedule next monitoring check based on urgency"""
        frequency_adjustments = {
            'critical': session.monitoring_frequency // 4,  # 4x more frequent
            'high': session.monitoring_frequency // 2,      # 2x more frequent
            'medium': session.monitoring_frequency,         # Normal frequency
            'low': session.monitoring_frequency * 2         # Half frequency
        }
        
        next_frequency = frequency_adjustments.get(urgency, session.monitoring_frequency)
        session.next_check = timezone.now() + timedelta(seconds=next_frequency)
        session.save()
    
    def _send_monitoring_notification(self, session_id: str, event_type: str, data: Dict):
        """Send monitoring notification via WebSocket"""
        if not HAS_CHANNELS:
            logger.debug("Channels not installed, skipping WebSocket notification")
            return
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"monitoring_{session_id}",
                    {
                        'type': 'monitoring_update',
                        'event_type': event_type,
                        'data': data,
                        'timestamp': timezone.now().isoformat()
                    }
                )
        except Exception as e:
            logger.error(f"Failed to send monitoring notification: {e}")
    
    def _send_vital_signs_notification(self, session_id: str, reading: VitalSignsReading, analysis: Dict):
        """Send vital signs notification"""
        if not HAS_CHANNELS:
            return
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"monitoring_{session_id}",
                    {
                        'type': 'vital_signs_update',
                        'reading_id': reading.id,
                        'status': analysis['status'],
                        'alerts': analysis['alerts'],
                        'recommendations': analysis['recommendations'],
                        'timestamp': timezone.now().isoformat()
                    }
                )
        except Exception as e:
            logger.error(f"Failed to send vital signs notification: {e}")
    
    def stop_monitoring_session(self, session_id: str) -> bool:
        """Stop monitoring session"""
        try:
            session = MonitoringSession.objects.get(session_id=session_id, active=True)
            session.active = False
            session.save()
            
            # Send notification
            self._send_monitoring_notification(session_id, 'stopped', {
                'reason': 'Session stopped by request',
                'timestamp': timezone.now().isoformat()
            })
            
            logger.info(f"Stopped monitoring session: {session_id}")
            return True
            
        except MonitoringSession.DoesNotExist:
            logger.error(f"Monitoring session not found: {session_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to stop monitoring session: {e}")
            return False


# Global instance
continuous_monitoring = ContinuousMonitoringSystem()
