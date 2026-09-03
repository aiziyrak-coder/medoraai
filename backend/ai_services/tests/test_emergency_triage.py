"""
103 Tezkor triaj testlari.

Asosiy talab: tizim HECH QACHON soxta klinik javob qaytarmasin.
AI yiqilsa — xato ko'tarilsin, "sariq / xavf yo'q" kabi to'qilgan triaj emas.
"""
from unittest import mock

from django.test import SimpleTestCase

from ai_services.emergency_triage import (
    EmergencyAIUnavailable,
    build_triage_prompt,
    normalize_triage,
    run_emergency_triage,
)


class NormalizeTriageTests(SimpleTestCase):
    def test_bosh_javob_hech_narsa_oylab_topmaydi(self):
        r = normalize_triage({})
        self.assertEqual(r["red_flags"], [])
        self.assertEqual(r["probable_conditions"], [])
        self.assertEqual(r["immediate_actions"], [])
        self.assertEqual(r["do_not"], [])
        self.assertEqual(r["disposition_reason"], "")
        self.assertFalse(r["time_critical"])

    def test_notogri_disposition_eng_ehtiyotkor_variantga_tushadi(self):
        self.assertEqual(normalize_triage({"disposition": "allaqanday"})["disposition"], "kuzatuv")
        self.assertEqual(normalize_triage({})["disposition"], "kuzatuv")

    def test_haqiqiy_disposition_saqlanadi(self):
        for d in ("reanimatsiya", "statsionar", "kuzatuv", "uyda_qoldirish"):
            self.assertEqual(normalize_triage({"disposition": d})["disposition"], d)

    def test_bosh_va_notogri_choralar_tashlanadi(self):
        r = normalize_triage({
            "immediate_actions": [
                {"action": "", "drug": ""},          # bo'sh - tashlanadi
                "matn",                                # dict emas - tashlanadi
                {"action": "Kislorod berish"},        # to'g'ri
                {"drug": "Adrenalin", "dose": "0.5 mg", "route": "m/i"},
            ],
        })
        self.assertEqual(len(r["immediate_actions"]), 2)
        self.assertEqual(r["immediate_actions"][0]["action"], "Kislorod berish")
        self.assertEqual(r["immediate_actions"][1]["drug"], "Adrenalin")

    def test_notogri_likelihood_tozalanadi(self):
        r = normalize_triage({"probable_conditions": [
            {"name": "Miokard infarkti", "likelihood": "YUQORI"},
            {"name": "Stenokardiya", "likelihood": "very high"},
            {"name": ""},   # nomsiz - tashlanadi
        ]})
        self.assertEqual(len(r["probable_conditions"]), 2)
        self.assertEqual(r["probable_conditions"][0]["likelihood"], "yuqori")
        self.assertEqual(r["probable_conditions"][1]["likelihood"], "")

    def test_advisory_doim_boladi(self):
        self.assertIn("feldsher", normalize_triage({})["advisory"].lower())


class PromptTests(SimpleTestCase):
    def test_yosh_va_jins_promptga_tushadi(self):
        msgs = build_triage_prompt(["ko'krak og'rig'i"], age_band="child", sex="female")
        text = " ".join(m.get("content", "") for m in msgs)
        self.assertIn("Bola", text)
        self.assertIn("Ayol", text)
        self.assertIn("ko'krak og'rig'i", text)

    def test_aniq_yosh_yosh_guruhidan_ustun(self):
        msgs = build_triage_prompt(["isitma"], age_band="adult", age_years=7)
        text = " ".join(m.get("content", "") for m in msgs)
        self.assertIn("7 yosh", text)

    def test_qoshimcha_izoh_promptga_tushadi(self):
        msgs = build_triage_prompt([], note="bemor hushidan ketdi")
        text = " ".join(m.get("content", "") for m in msgs)
        self.assertIn("hushidan ketdi", text)


class FailureNeverFabricatesTests(SimpleTestCase):
    """Eng muhim testlar: nosozlikda soxta triaj chiqmasligi."""

    def test_ai_xato_bersa_istisno_kotariladi(self):
        with mock.patch("ai_services.emergency_triage.call_model", side_effect=TimeoutError("timeout")):
            with self.assertRaises(EmergencyAIUnavailable):
                run_emergency_triage(["ko'krak og'rig'i"], age_band="adult")

    def test_bosh_javobda_istisno_kotariladi(self):
        with mock.patch("ai_services.emergency_triage.call_model", return_value="   "):
            with self.assertRaises(EmergencyAIUnavailable):
                run_emergency_triage(["ko'krak og'rig'i"], age_band="adult")

    def test_json_boladi_bolmagan_javobda_istisno_kotariladi(self):
        with mock.patch("ai_services.emergency_triage.call_model", return_value="salom, men model"):
            with mock.patch("ai_services.emergency_triage.parse_json", return_value={}):
                with self.assertRaises(EmergencyAIUnavailable):
                    run_emergency_triage(["bosh og'rig'i"], age_band="adult")

    def test_togri_javob_otadi(self):
        payload = {
            "red_flags": ["Ko'krak og'rig'i + terlash"],
            "time_critical": True,
            "probable_conditions": [{"name": "O'tkir koronar sindrom", "likelihood": "yuqori", "why": "tipik"}],
            "immediate_actions": [{"action": "Aspirin chaynatish", "drug": "Aspirin", "dose": "300 mg", "route": "t/o"}],
            "do_not": ["Bemorni yurgizmang"],
            "disposition": "statsionar",
            "disposition_reason": "OKS gumoni",
            "clarify": [],
        }
        with mock.patch("ai_services.emergency_triage.call_model", return_value="{}"):
            with mock.patch("ai_services.emergency_triage.parse_json", return_value=payload):
                r = run_emergency_triage(["ko'krak og'rig'i"], age_band="adult", sex="male")
        self.assertEqual(r["disposition"], "statsionar")
        self.assertTrue(r["time_critical"])
        self.assertEqual(len(r["red_flags"]), 1)
        self.assertEqual(r["immediate_actions"][0]["dose"], "300 mg")
