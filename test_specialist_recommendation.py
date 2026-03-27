"""
Test: Mutaxassis tavsiyalari tezligi va aniqligi
"""
import sys
import os
import time
from pathlib import Path

# Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

import django
django.setup()

from ai_services.azure_utils import recommend_specialists_fast, patient_text

# Test bemor ma'lumotlari
test_cases = [
    {
        'name': 'Yurak kasalligi',
        'data': {
            'firstName': 'Ali',
            'complaints': 'Yurak og\'riq, qon bosimi yuqori, puls tezlashgan',
            'age': 45,
        }
    },
    {
        'name': 'Nerv tizimi',
        'data': {
            'firstName': 'Vali',
            'complaints': 'Bosh og\'riq kuchli, bosh aylanishi, migren',
            'age': 32,
        }
    },
    {
        'name': 'O\'pka kasalligi',
        'data': {
            'firstName': 'Gani',
            'complaints': 'Nafas qisilishi, yo\'tal, o\'pka astmasi bor',
            'age': 28,
        }
    },
    {
        'name': 'Jigar kasalligi',
        'data': {
            'firstName': 'Sanobar',
            'complaints': 'Jigar og\'riq, gastrit, oshqozon bezillashi',
            'age': 50,
        }
    },
]

print("=" * 60)
print("MUTAXASSIS TAVSIYA TEST - TEZKOR REJIM")
print("=" * 60)

for test in test_cases:
    print(f"\n{test['name']}:")
    print(f"Bemor: {test['data']['firstName']}, {test['data']['age']} yosh")
    print(f"Shikoyat: {test['data']['complaints']}")
    
    start = time.time()
    result = recommend_specialists_fast(test['data'])
    elapsed = time.time() - start
    
    print(f"⏱ Vaqt: {elapsed*1000:.2f}ms")
    print(f"📋 Mutaxassislar ({len(result)} ta):")
    for i, rec in enumerate(result, 1):
        print(f"   {i}. {rec['model']} - {rec['reason']}")
    print()

print("\n" + "=" * 60)
print("TEST YAKUNLANDI")
print("=" * 60)
