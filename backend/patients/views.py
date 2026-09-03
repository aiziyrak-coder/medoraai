"""
Patient Views
"""
import logging

from django.core.cache import cache
from django.http import FileResponse
from django.utils.encoding import escape_uri_path
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from accounts.permissions import IsAuthenticatedWithSubscription
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db.models import Q, Count, Max
from django_filters.rest_framework import DjangoFilterBackend
from accounts.group_scope import clinic_peer_user_ids, filter_queryset_by_clinic_peers
from datetime import timedelta

from django.utils import timezone

from analyses.models import AnalysisRecord, ImagingStudyRecord
from analyses.imaging_context import build_imaging_context_from_report
from analyses.serializers import ImagingStudyRecordSerializer, ImagingStudyRecordCreateSerializer
from .models import Patient, PatientAttachment
from .access import user_can_view_clinical, strip_clinical_payload
from .registry_number import registry_number_lookup_q
from .phone import normalize_patient_phone, patient_phone_variants
from .dedup import find_existing_patient
from .address_data import load_address_catalog, search_districts
from .population_service import population_to_dict, search_population
from .serializers import (
    PatientSerializer, PatientCreateSerializer,
    PatientUpdateSerializer, PatientAttachmentSerializer,
    PatientPassportSerializer, PatientRegistryWriteSerializer,
)

logger = logging.getLogger(__name__)

# Dosye (klinikalararo o'qish) uchun so'rov cheklovi — brute-force ni to'xtatadi.
DOSSIER_RATE_LIMIT_MAX = 30
DOSSIER_RATE_LIMIT_WINDOW = 3600  # 1 soat
DOSSIER_RATE_LIMIT_KEY = 'dossier_lookup:{user_id}'


class PatientViewSet(viewsets.ModelViewSet):
    """Patient CRUD operations"""
    queryset = Patient.objects.all()
    permission_classes = [IsAuthenticated, IsAuthenticatedWithSubscription]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['gender', 'region_id', 'district_id']
    search_fields = ['first_name', 'last_name', 'father_name', 'phone', 'registry_number']
    ordering_fields = ['created_at', 'first_name', 'last_name']
    ordering = ['-created_at']

    def filter_queryset(self, queryset):
        """ID qidiruvi global — registrator bemorlari ham barcha shifokorga ko'rinadi."""
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            return self._search_patients_global(self._global_patient_queryset(), search)
        patient_id = (self.request.query_params.get('patient_id') or '').strip()
        lookup = registry_number_lookup_q(patient_id)
        if lookup is not None:
            return self._global_patient_queryset().filter(lookup)
        return super().filter_queryset(queryset)

    def _search_patients_global(self, qs, q: str):
        """Pasport qidiruv — klinika guruhsiz, barcha ro'yxatdan o'tgan bemorlar."""
        q = (q or '').strip()
        if not q:
            return qs.none()
        lookup = registry_number_lookup_q(q)
        if lookup is not None:
            return qs.filter(lookup | Q(phone__icontains=q))
        tokens = [t for t in q.split() if t]
        clause = (
            Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(father_name__icontains=q)
            | Q(phone__icontains=q)
            | Q(registry_number__icontains=q)
        )
        if len(tokens) >= 2:
            clause |= Q(
                first_name__icontains=tokens[0],
                last_name__icontains=tokens[-1],
            )
        elif len(tokens) == 1:
            token = tokens[0]
            clause |= Q(first_name__istartswith=token) | Q(last_name__istartswith=token)
        return qs.filter(clause).order_by('-updated_at')[:20]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PatientUpdateSerializer
        elif self.action in ('registry_register', 'registry_update'):
            return PatientRegistryWriteSerializer
        elif self.action == 'passport':
            return PatientPassportSerializer
        return PatientSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Patient.objects.select_related(
            'created_by', 'created_by__clinic_group', 'home_clinic_group',
        )
        if user.is_superuser or user.is_staff:
            return queryset
        ids = clinic_peer_user_ids(user)
        return queryset.filter(
            Q(created_by_id__in=ids)
            | Q(home_clinic_group_id=user.clinic_group_id)
            | Q(analyses__created_by_id__in=ids)
        ).distinct()

    def _global_patient_queryset(self):
        return Patient.objects.select_related('created_by', 'home_clinic_group')

    def _assert_can_modify(self, patient: Patient):
        """Yozish faqat o'z klinika guruhi bemorlariga (superuser/staff — hammasi)."""
        if not user_can_view_clinical(self.request.user, patient):
            raise PermissionDenied(
                "Boshqa klinika guruhining bemorini o'zgartirish mumkin emas.",
            )

    def get_object(self):
        """Pasport/konsilium: bemor global topiladi, ammo yozish o'z guruhi bilan chegaralangan."""
        if self.action in ('list', 'create'):
            return super().get_object()
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        pk = self.kwargs.get(lookup_url_kwarg)
        try:
            obj = self._global_patient_queryset().get(pk=pk)
        except (Patient.DoesNotExist, TypeError, ValueError):
            raise NotFound('Bemor topilmadi')
        if self.action in ('update', 'partial_update', 'destroy'):
            self._assert_can_modify(obj)
        if self.action == 'destroy':
            user = self.request.user
            if not (user.is_superuser or user.is_staff):
                if obj.created_by_id and obj.created_by_id != user.id:
                    raise PermissionDenied("Bemorni faqat uni yaratgan shifokor o'chirishi mumkin.")
        return obj

    def retrieve(self, request, *args, **kwargs):
        """Pasport global — klinik maydonlar faqat ruxsat bo'yicha."""
        try:
            patient = self._global_patient_queryset().get(pk=kwargs.get('pk'))
        except (Patient.DoesNotExist, TypeError, ValueError):
            raise NotFound('Bemor topilmadi')
        serializer = PatientSerializer(patient, context=self.get_serializer_context())
        data = serializer.data
        if not user_can_view_clinical(request.user, patient):
            data = strip_clinical_payload(data)
        return Response(data)

    def perform_destroy(self, instance):
        user = self.request.user
        if user.is_superuser or user.is_staff:
            return super().perform_destroy(instance)
        if instance.created_by_id and instance.created_by_id != user.id:
            raise PermissionDenied("Bemorni faqat uni yaratgan shifokor o'chirishi mumkin.")
        return super().perform_destroy(instance)
    
    def _last_analysis_summary(self, patient: Patient, peer_ids: set[int] | None = None) -> dict:
        qs = AnalysisRecord.objects.filter(patient=patient).select_related('created_by')
        if peer_ids is not None:
            qs = qs.filter(created_by_id__in=peer_ids)
        rec = qs.order_by('-created_at').first()
        if not rec:
            return {}
        fr = rec.final_report if isinstance(rec.final_report, dict) else {}
        cd = fr.get('consensusDiagnosis') or fr.get('consensus_diagnosis') or []
        if isinstance(cd, dict):
            cd = [cd]
        dx = ''
        if cd and isinstance(cd[0], dict):
            dx = str(cd[0].get('name') or '')
        physician = ''
        if rec.created_by:
            physician = str(getattr(rec.created_by, 'name', '') or rec.created_by)
        complaints = ''
        if isinstance(rec.patient_data, dict):
            complaints = str(rec.patient_data.get('complaints') or '')
        return {
            'last_analysis_id': rec.id,
            'last_analysis_at': rec.created_at.isoformat() if rec.created_at else '',
            'last_diagnosis': dx,
            'last_complaint': complaints[:200],
            'last_physician': physician,
        }

    def _passport_hit(self, p: Patient, user) -> dict:
        raw_peers = clinic_peer_user_ids(user)
        peer_ids = set(raw_peers) if raw_peers is not None else set()
        can_clinical = user_can_view_clinical(user, p)
        last = self._last_analysis_summary(p, peer_ids if not can_clinical and peer_ids else None)
        ser = PatientPassportSerializer(p, context=self.get_serializer_context())
        data = ser.data
        analysis_filter = {}
        if not can_clinical and peer_ids:
            analysis_filter['created_by_id__in'] = peer_ids
        data['analysis_count'] = AnalysisRecord.objects.filter(patient=p, **analysis_filter).count()
        data['last_analysis_at'] = last.get('last_analysis_at', '')
        data['last_diagnosis'] = last.get('last_diagnosis', '') if can_clinical else ''
        data['last_complaint'] = last.get('last_complaint', '') if can_clinical else ''
        data['last_physician'] = last.get('last_physician', '') if can_clinical else ''
        data['can_view_clinical'] = can_clinical
        return data

    def _combined_passport_search(self, request, q: str) -> list[dict]:
        """Avval aholi bazasi, keyin bemorlar (pasport bo'yicha dublikat yo'q)."""
        seen_rn: set[str] = set()
        results: list[dict] = []
        # Aholi bazasi faqat o'z klinika guruhi doirasida (PopulationViewSet bilan bir xil).
        for rec in search_population(q, user=request.user):
            rn = (rec.registry_number or '').upper()
            if rn in seen_rn:
                continue
            seen_rn.add(rn)
            results.append(population_to_dict(rec))
        patient_qs = self._search_patients_global(self._global_patient_queryset(), q)
        for p in patient_qs:
            rn = (p.registry_number or '').upper()
            if rn in seen_rn:
                continue
            seen_rn.add(rn)
            hit = self._passport_hit(p, request.user)
            hit['source'] = 'patient'
            hit['is_patient'] = True
            results.append(hit)
        return results[:20]

    @action(detail=False, methods=['get'], url_path='regions')
    def regions(self, request):
        """Viloyat va tumanlar katalogi."""
        return Response({'success': True, 'data': load_address_catalog()['regions']})

    @action(detail=False, methods=['get'], url_path='district-search')
    def district_search(self, request):
        q = (request.query_params.get('q') or '').strip()
        return Response({'success': True, 'data': search_districts(q)})

    @action(detail=False, methods=['get'], url_path='location-stats')
    def location_stats(self, request):
        """Dashboard: viloyat va tuman bo'yicha bemorlar statistikasi (guruh)."""
        from collections import Counter
        from .address_data import load_address_catalog

        catalog = load_address_catalog()
        region_names = {r['id']: r['name_uz'] for r in catalog['regions']}
        district_meta: dict[str, dict] = {}
        for r in catalog['regions']:
            for d in r['districts']:
                district_meta[str(d['id'])] = {
                    'district_name': d['name_uz'],
                    'region_id': r['id'],
                    'region_name': r['name_uz'],
                }

        base_qs = self.get_queryset()
        region_counts = Counter(
            base_qs.exclude(region_id='').values_list('region_id', flat=True),
        )
        district_counts = Counter(
            base_qs.exclude(district_id='').values_list('district_id', flat=True),
        )

        regions = [
            {'region_id': rid, 'region_name': region_names.get(rid, rid), 'count': cnt}
            for rid, cnt in region_counts.most_common(14)
        ]
        districts = []
        for did, cnt in district_counts.most_common(12):
            meta = district_meta.get(str(did), {})
            districts.append({
                'district_id': did,
                'district_name': meta.get('district_name', str(did)),
                'region_id': meta.get('region_id', ''),
                'region_name': meta.get('region_name', ''),
                'count': cnt,
            })

        return Response({
            'success': True,
            'data': {'regions': regions, 'districts': districts},
        })

    @action(detail=False, methods=['get'], url_path='registry-search')
    def registry_search(self, request):
        """Global pasport qidiruv — barcha klinika guruhlari."""
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 1:
            return Response({'success': True, 'data': []})
        return Response({
            'success': True,
            'data': self._combined_passport_search(request, q),
        })

    @action(detail=False, methods=['post'], url_path='registry')
    def registry_register(self, request):
        """Yangi bemor pasport ma'lumotlari yoki mavjud ID ni yangilash."""
        patient_id = request.data.get('id') or request.data.get('patient_id')
        if patient_id:
            try:
                patient = self._global_patient_queryset().get(pk=int(patient_id))
            except (Patient.DoesNotExist, TypeError, ValueError):
                return Response({
                    'success': False,
                    'error': {'message': 'Bemor topilmadi'},
                }, status=status.HTTP_404_NOT_FOUND)
            # Mavjud bemorni yangilash — faqat o'z klinika guruhi doirasida.
            self._assert_can_modify(patient)
            serializer = PatientRegistryWriteSerializer(
                patient, data=request.data, partial=True, context={'request': request},
            )
        else:
            serializer = PatientRegistryWriteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()
        return Response({
            'success': True,
            'data': self._passport_hit(patient, request.user),
            'message': 'Bemor ro\'yxatdan o\'tkazildi',
        }, status=status.HTTP_201_CREATED if not patient_id else status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='passport')
    def passport(self, request, pk=None):
        """Faqat pasport ma'lumotlari (chek ID bo'yicha)."""
        try:
            patient = self._global_patient_queryset().get(pk=pk)
        except Patient.DoesNotExist:
            return Response({
                'success': False,
                'error': {'message': 'Bemor topilmadi'},
            }, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'data': self._passport_hit(patient, request.user)})

    def _dossier_analysis(self, rec) -> dict:
        """Konsilium yozuvi — frontend apiToAnalysisRecord kutgan shaklda (klinika guruhidan qat'i nazar)."""
        cg = getattr(rec.created_by, 'clinic_group', None)
        return {
            'id': rec.id,
            'patient_id': str(rec.patient_id or ''),
            'patient_data': rec.patient_data if isinstance(rec.patient_data, dict) else {},
            'debate_history': rec.debate_history if isinstance(rec.debate_history, list) else [],
            'final_report': rec.final_report if isinstance(rec.final_report, dict) else {},
            'follow_up_history': rec.follow_up_history if isinstance(rec.follow_up_history, list) else [],
            'selected_specialists': rec.selected_specialists if isinstance(rec.selected_specialists, list) else [],
            'detected_medications': rec.detected_medications if isinstance(rec.detected_medications, list) else [],
            'physician': str(getattr(rec.created_by, 'name', '') or rec.created_by or ''),
            'clinic_group': str(getattr(cg, 'name', '') or ''),
            'created_at': rec.created_at.isoformat() if rec.created_at else '',
            'updated_at': rec.updated_at.isoformat() if rec.updated_at else '',
        }

    @action(detail=False, methods=['get'], url_path='dossier')
    def dossier(self, request):
        """Bemor dosyesi — pasport ID (registry) bo'yicha BARCHA ma'lumot.

        Har qanday klinika guruhiga tegishli shifokor pasport seriya raqamini kiritsa,
        bemorning barcha konsiliumlari, tasvir tahlillari, yuklangan fayllari va
        klinik ma'lumotlarini ko'ra oladi (klinika guruhi chegarasidan tashqari).
        """
        # Faqat haqiqiy pasport/registr raqami bo'yicha — ketma-ket ID bilan yuklab
        # olishning oldini olish uchun `?id=` qidiruvi olib tashlandi.
        registry = (
            request.query_params.get('registry')
            or request.query_params.get('patient_id')
            or request.query_params.get('q')
            or ''
        ).strip()
        if not registry:
            return Response({
                'success': False,
                'error': {'message': 'Pasport ID (registry) kiritilishi shart'},
            }, status=status.HTTP_400_BAD_REQUEST)

        # Klinikalararo dosye — foydalanuvchi bo'yicha so'rov cheklovi.
        rate_key = DOSSIER_RATE_LIMIT_KEY.format(user_id=getattr(request.user, 'id', 0))
        lookups = cache.get(rate_key, 0)
        if lookups >= DOSSIER_RATE_LIMIT_MAX:
            return Response({
                'success': False,
                'error': {
                    'code': 429,
                    'message': "Juda ko'p dosye so'rovlari. Iltimos, keyinroq urinib ko'ring.",
                },
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        cache.set(rate_key, lookups + 1, DOSSIER_RATE_LIMIT_WINDOW)

        patient = None
        qs = self._global_patient_queryset()
        lookup = registry_number_lookup_q(registry)
        if lookup is not None:
            patient = qs.filter(lookup).order_by('-updated_at').first()
        if patient is None:
            patient = qs.filter(
                Q(registry_number__iexact=registry) | Q(phone=registry),
            ).order_by('-updated_at').first()

        if patient is None:
            return Response({
                'success': False,
                'error': {'message': 'Bunday pasport ID bilan bemor topilmadi'},
            }, status=status.HTTP_404_NOT_FOUND)

        ctx = self.get_serializer_context()
        ctx['force_clinical'] = True

        patient_data = PatientSerializer(patient, context=ctx).data

        analyses_qs = (
            AnalysisRecord.objects.filter(patient=patient)
            .select_related('created_by', 'created_by__clinic_group')
            .order_by('-created_at')
        )
        analyses = [self._dossier_analysis(rec) for rec in analyses_qs]

        imaging_qs = (
            ImagingStudyRecord.objects.filter(patient=patient)
            .select_related('created_by')
            .order_by('-created_at')
        )
        imaging = ImagingStudyRecordSerializer(imaging_qs, many=True, context=ctx).data

        attachments = PatientAttachmentSerializer(
            patient.attachments.all().order_by('-uploaded_at'), many=True, context=ctx,
        ).data

        home_cg = getattr(patient, 'home_clinic_group', None)

        # Klinika guruhlararo kirishni audit uchun jurnalga yozamiz (klinik ma'lumotsiz).
        try:
            logger.info(
                'DOSSIER access: user=%s (clinic=%s) -> patient=%s (registry=%s, home_clinic=%s)',
                getattr(request.user, 'id', '?'),
                getattr(request.user, 'clinic_group_id', None),
                patient.id, patient.registry_number,
                getattr(home_cg, 'id', None),
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'data': {
                'patient': patient_data,
                'analyses': analyses,
                'imaging_studies': imaging,
                'attachments': attachments,
                'meta': {
                    'analysis_count': len(analyses),
                    'imaging_count': len(imaging),
                    'attachment_count': len(attachments),
                    'home_clinic_group': str(getattr(home_cg, 'name', '') or ''),
                    'registered_by': str(getattr(patient.created_by, 'name', '') or patient.created_by or ''),
                },
            },
        })

    @action(detail=False, methods=['get'], url_path='smart-search')
    def smart_search(self, request):
        """Aqlli qidiruv — barcha klinikalardan (registrator bemorlari ham), guruhsiz."""
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 1:
            return Response({'success': True, 'data': []})
        return Response({
            'success': True,
            'data': self._combined_passport_search(request, q),
        })

    @action(detail=False, methods=['get'], url_path='match')
    def match_patients(self, request):
        """Ism/familiya/telefon bo'yicha mavjud bemorlarni topish (global pasport)."""
        fn = (request.query_params.get('first_name') or '').strip()
        ln = (request.query_params.get('last_name') or '').strip()
        phone = (request.query_params.get('phone') or '').strip()
        father = (request.query_params.get('father_name') or '').strip()
        age = (request.query_params.get('age') or '').strip()
        if not fn and not ln and not phone:
            return Response({'success': True, 'data': []})

        exact = find_existing_patient(
            phone=phone or None,
            first_name=fn or None,
            last_name=ln or None,
            father_name=father or None,
            age=age or None,
        )
        if exact and (phone or (fn and ln)):
            qs = self._global_patient_queryset().filter(pk=exact.pk)
        else:
            qs = self._global_patient_queryset()
            if phone:
                variants = patient_phone_variants(phone)
                normalized = normalize_patient_phone(phone)
                if variants:
                    qs = qs.filter(Q(phone__in=variants) | Q(phone=normalized))
            if fn:
                qs = qs.filter(first_name__icontains=fn)
            if ln:
                qs = qs.filter(last_name__icontains=ln)
            if father:
                qs = qs.filter(father_name__icontains=father)
        data = PatientPassportSerializer(
            qs.order_by('-updated_at')[:10], many=True, context={'request': request},
        ).data
        return Response({'success': True, 'data': data})

    @action(detail=True, methods=['get'], url_path='clinical-timeline')
    def clinical_timeline(self, request, pk=None):
        """Bemorning barcha oldingi tahlillari (klinika guruhi) — yillar bo'yi konsilium konteksti."""
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            return Response({
                'success': False,
                'error': {'message': 'Klinik tarix mavjud emas yoki ruxsat yo\'q'},
            }, status=status.HTTP_403_FORBIDDEN)
        try:
            limit = min(int(request.query_params.get('limit', 200)), 500)
        except (TypeError, ValueError):
            limit = 200

        base_qs = filter_queryset_by_clinic_peers(
            AnalysisRecord.objects.filter(patient=patient).select_related('created_by'),
            request.user,
        ).order_by('-created_at')
        total = base_qs.count()
        records = base_qs.defer('debate_history', 'follow_up_history')[:limit]

        timeline = []
        for rec in records:
            fr = rec.final_report if isinstance(rec.final_report, dict) else {}
            cd = fr.get('consensusDiagnosis') or fr.get('consensus_diagnosis') or []
            if isinstance(cd, dict):
                cd = [cd]
            dx_names = []
            justification = ''
            for item in cd[:4]:
                if isinstance(item, dict) and item.get('name'):
                    dx_names.append(str(item['name']))
                    if not justification:
                        justification = str(item.get('justification') or '')[:400]
            physician = ''
            if rec.created_by:
                physician = str(getattr(rec.created_by, 'name', '') or rec.created_by)
            meds = []
            for m in (fr.get('medicationRecommendations') or fr.get('medications') or [])[:5]:
                if isinstance(m, dict) and m.get('name'):
                    meds.append(str(m['name']))
            timeline.append({
                'id': rec.id,
                'date': rec.created_at.isoformat() if rec.created_at else '',
                'physician': physician,
                'complaints': (rec.patient_data or {}).get('complaints', '') if isinstance(rec.patient_data, dict) else '',
                'consensus_diagnoses': dx_names,
                'justification': justification,
                'treatment_plan': (fr.get('treatmentPlan') or fr.get('treatment_plan') or [])[:8],
                'recommended_tests': (fr.get('recommendedTests') or fr.get('recommended_tests') or [])[:8],
                'medications': meds,
                'follow_up': fr.get('follow_up_plan') or fr.get('followUpPlan') or '',
            })
        return Response({
            'success': True,
            'data': {
                'patient': PatientSerializer(patient, context={'request': request}).data,
                'analyses': timeline,
                'analysis_count': total,
            },
        })

    @action(detail=True, methods=['get', 'post'], url_path='imaging-studies')
    def imaging_studies(self, request, pk=None):
        """Klinika guruhi ichida UZI/UTT/Rengen tahlillari (GET so'nggi N kun, POST yangi)."""
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            return Response({
                'success': False,
                'error': {'message': 'Tasvir tahlillari uchun ruxsat yo\'q'},
            }, status=status.HTTP_403_FORBIDDEN)

        base_qs = filter_queryset_by_clinic_peers(
            ImagingStudyRecord.objects.filter(patient=patient).select_related('created_by'),
            request.user,
        ).order_by('-created_at')

        if request.method == 'GET':
            try:
                days = min(int(request.query_params.get('days', 30)), 365)
            except (TypeError, ValueError):
                days = 30
            cutoff = timezone.now() - timedelta(days=days)
            records = base_qs.filter(created_at__gte=cutoff)
            data = ImagingStudyRecordSerializer(records, many=True).data
            return Response({
                'success': True,
                'data': data,
                'meta': {'count': len(data), 'days': days},
            })

        ser = ImagingStudyRecordCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        modality = ser.validated_data['modality']
        report = ser.validated_data['report']
        study_date = timezone.now().strftime('%Y-%m-%d')
        summary_text, imaging_structured = build_imaging_context_from_report(
            report, modality, study_date,
        )
        record = ImagingStudyRecord.objects.create(
            patient=patient,
            modality=modality,
            report=report,
            summary_text=summary_text,
            imaging_structured=imaging_structured,
            created_by=request.user,
        )
        return Response({
            'success': True,
            'data': ImagingStudyRecordSerializer(record).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='imaging-studies/has-recent')
    def imaging_studies_has_recent(self, request, pk=None):
        """Bemorda so'nggi N kun ichida tahlil qilingan tasvir bormi (tez tekshiruv)."""
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            return Response({'success': True, 'data': {'has_recent': False, 'count': 0}})
        try:
            days = min(int(request.query_params.get('days', 30)), 365)
        except (TypeError, ValueError):
            days = 30
        cutoff = timezone.now() - timedelta(days=days)
        count = filter_queryset_by_clinic_peers(
            ImagingStudyRecord.objects.filter(patient=patient, created_at__gte=cutoff),
            request.user,
        ).count()
        return Response({
            'success': True,
            'data': {'has_recent': count > 0, 'count': count, 'days': days},
        })

    @action(detail=True, methods=['post'], url_path='upload-attachment')
    def upload_attachment(self, request, pk=None):
        """Upload file attachment for patient with validation"""
        import os
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            raise PermissionDenied('Klinik fayllar uchun ruxsat yo\'q')
        file = request.FILES.get('file')
        
        if not file:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Fayl yuklanmadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        max_size = 10 * 1024 * 1024
        if file.size > max_size:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': f'Fayl hajmi {max_size / 1024 / 1024}MB dan oshmasligi kerak'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        allowed_types = [
            'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]
        if file.content_type not in allowed_types:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Faqat rasm (JPG, PNG), PDF yoki Word/Excel fayllari qabul qilinadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        allowed_extensions = (
            '.jpg', '.jpeg', '.png', '.gif', '.pdf',
            '.doc', '.docx', '.xls', '.xlsx',
        )
        name = getattr(file, 'name', '') or ''
        if not any(name.lower().endswith(ext) for ext in allowed_extensions):
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_400_BAD_REQUEST,
                    'message': 'Faqat rasm (JPG, PNG), PDF yoki Word/Excel fayllari qabul qilinadi'
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        filename = os.path.basename(file.name)
        if len(filename) > 255:
            filename = filename[:255]
        
        try:
            attachment = PatientAttachment.objects.create(
                patient=patient,
                file=file,
                name=filename,
                mime_type=file.content_type
            )
            
            serializer = PatientAttachmentSerializer(attachment)
            return Response({
                'success': True,
                'message': 'Fayl muvaffaqiyatli yuklandi',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"File upload error: {e}", exc_info=True)
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
                    'message': 'Fayl yuklashda xatolik yuz berdi'
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'], url_path='attachments/(?P<attachment_id>[^/.]+)/download')
    def download_attachment(self, request, pk=None, attachment_id=None):
        """
        Bemor faylini himoyalangan holda berish.

        `/media/` ni nginx to'g'ridan-to'g'ri bermasligi kerak: fayl URL'ini
        bilgan har kim bemor tahlilini ocha olardi. Endi har yuklab olish
        ruxsatdan o'tadi.
        """
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            raise PermissionDenied("Klinik fayllar uchun ruxsat yo'q")
        try:
            attachment = PatientAttachment.objects.get(id=attachment_id, patient_id=patient.pk)
        except (PatientAttachment.DoesNotExist, TypeError, ValueError):
            raise NotFound('Fayl topilmadi')

        try:
            fh = attachment.file.open('rb')
        except (FileNotFoundError, ValueError):
            logger.warning('Attachment file missing on disk: id=%s', attachment_id)
            raise NotFound('Fayl topilmadi')

        response = FileResponse(
            fh,
            content_type=attachment.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{escape_uri_path(attachment.name)}"'
        response['X-Content-Type-Options'] = 'nosniff'
        logger.info(
            'Attachment download: user=%s patient=%s attachment=%s',
            request.user.id, patient.pk, attachment_id,
        )
        return response

    @action(detail=True, methods=['delete'], url_path='attachments/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        """Delete patient attachment"""
        patient = self.get_object()
        if not user_can_view_clinical(request.user, patient):
            raise PermissionDenied('Klinik fayllar uchun ruxsat yo\'q')
        try:
            attachment = PatientAttachment.objects.get(id=attachment_id, patient_id=pk)
            attachment.delete()
            return Response({
                'success': True,
                'message': 'Fayl o\'chirildi'
            })
        except PatientAttachment.DoesNotExist:
            return Response({
                'success': False,
                'error': {
                    'code': status.HTTP_404_NOT_FOUND,
                    'message': 'Fayl topilmadi'
                }
            }, status=status.HTTP_404_NOT_FOUND)
