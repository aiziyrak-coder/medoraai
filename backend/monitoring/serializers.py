"""
Monitoring API serializers.
"""
from rest_framework import serializers
from .models import Ward, Room, Device, PatientMonitor, VitalReading, AlarmThreshold, Alarm, MonitoringAuditLog, MonitoringNote


class WardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ward
        fields = ['id', 'name', 'code', 'description', 'is_active', 'created_at', 'updated_at']


class RoomSerializer(serializers.ModelSerializer):
    ward_name = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'ward', 'ward_name', 'name', 'code', 'description', 'is_active', 'created_at', 'updated_at']

    def get_ward_name(self, obj):
        return obj.ward.name if obj.ward_id else None


class DeviceSerializer(serializers.ModelSerializer):
    room_name = serializers.SerializerMethodField()
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = [
            'id', 'model', 'serial_number', 'room', 'room_name',
            'host', 'port',
            'status', 'effective_status', 'last_seen_at', 'meta', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['status', 'last_seen_at']

    def get_room_name(self, obj):
        return obj.room.name if obj.room_id else None

    def get_effective_status(self, obj):
        """Online if last_seen_at within last 2 minutes, else offline."""
        from .services import effective_device_status
        return effective_device_status(obj)


class DeviceRegisterSerializer(serializers.ModelSerializer):
    """POST /api/v1/devices/register – yangi monitor qoʻshish."""
    class Meta:
        model = Device
        fields = ['model', 'serial_number', 'room', 'host', 'port', 'meta']


class PatientMonitorSerializer(serializers.ModelSerializer):
    device_serial = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientMonitor
        fields = [
            'id', 'device', 'device_serial', 'room', 'room_name',
            'bed_label', 'patient_name', 'patient_identifier',
            'age', 'gender', 'medical_notes', 'bed_status', 'assigned_to', 'assigned_to_name',
            'is_active', 'created_at', 'updated_at'
        ]

    def get_device_serial(self, obj):
        return obj.device.serial_number if obj.device_id else None

    def get_room_name(self, obj):
        return obj.room.name if obj.room_id else None

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.name if obj.assigned_to_id else None


class VitalReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalReading
        fields = [
            'id', 'patient_monitor', 'timestamp', 'heart_rate', 'spo2',
            'nibp_systolic', 'nibp_diastolic', 'respiration_rate', 'temperature', 'raw_payload'
        ]
        read_only_fields = ['timestamp']


class AlarmThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlarmThreshold
        fields = ['id', 'patient_monitor', 'param', 'min_value', 'max_value', 'severity', 'is_active']


class AlarmSerializer(serializers.ModelSerializer):
    patient_monitor_display = serializers.SerializerMethodField()

    class Meta:
        model = Alarm
        fields = [
            'id', 'patient_monitor', 'patient_monitor_display', 'threshold', 'param',
            'value', 'severity', 'message', 'acknowledged_at', 'acknowledged_by', 'created_at'
        ]
        read_only_fields = ['acknowledged_at', 'acknowledged_by']

    def get_patient_monitor_display(self, obj):
        return obj.patient_monitor.patient_name or obj.patient_monitor.bed_label or obj.patient_monitor.device.serial_number


class MonitoringAuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    patient_monitor_display = serializers.SerializerMethodField()

    class Meta:
        model = MonitoringAuditLog
        fields = ['id', 'patient_monitor', 'patient_monitor_display', 'action', 'user', 'user_name', 'details', 'created_at']

    def get_patient_monitor_display(self, obj):
        if not obj.patient_monitor:
            return None
        pm = obj.patient_monitor
        return pm.patient_name or pm.bed_label or pm.device.serial_number


class MonitoringNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = MonitoringNote
        fields = ['id', 'patient_monitor', 'note', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['created_by']
