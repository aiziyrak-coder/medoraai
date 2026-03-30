"""Minimal smoke tests — deploy tekshiruvi uchun."""
from django.test import TestCase, Client


class HealthEndpointTests(TestCase):
    def test_health_json(self):
        c = Client()
        r = c.get('/health/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('healthy', r.content.decode('utf-8').lower())
