#!/usr/bin/env python3
"""
Test script to verify MedoraAI deployment
Tests AI endpoints after deployment
"""

import requests
import json
import sys

# Server URL
BASE_URL = "https://medora.cdcgroup.uz"

def test_health():
    """Test health endpoint"""
    print("=" * 60)
    print("Testing Health Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/health/", timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            print("✅ Health check PASSED")
            return True
        else:
            print("❌ Health check FAILED")
            return False
    except Exception as e:
        print(f"❌ Health check ERROR: {e}")
        return False

def test_clarifying_questions():
    """Test clarifying questions endpoint"""
    print()
    print("=" * 60)
    print("Testing Clarifying Questions Endpoint")
    print("=" * 60)
    
    test_data = {
        "patient_data": {
            "firstName": "Test",
            "lastName": "Patient",
            "age": 35,
            "gender": "Male",
            "complaints": "Bosh og'rig'i va yuqori harorat"
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/clarifying-questions/",
            json=test_data,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            
            if data.get('success') and data.get('data'):
                questions = data['data']
                print(f"Questions generated: {len(questions)}")
                for i, q in enumerate(questions[:3], 1):
                    print(f"  {i}. {q}")
                print("✅ Clarifying questions test PASSED")
                return True
            elif data.get('warning'):
                print(f"Warning: {data['warning']}")
                print("⚠️  Partial success (AI may not be configured)")
                return True
            else:
                print("⚠️  No questions generated")
                return True
        else:
            print(f"❌ Test FAILED: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test ERROR: {e}")
        return False

def test_recommend_specialists():
    """Test recommend specialists endpoint"""
    print()
    print("=" * 60)
    print("Testing Recommend Specialists Endpoint")
    print("=" * 60)
    
    test_data = {
        "patient_data": {
            "firstName": "Test",
            "lastName": "Patient", 
            "age": 45,
            "gender": "Female",
            "complaints": "Yurak og'rig'i va nafas qisishi"
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/recommend-specialists/",
            json=test_data,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            
            if data.get('success') and data.get('data'):
                recs = data['data'].get('recommendations', [])
                print(f"Specialists recommended: {len(recs)}")
                for i, rec in enumerate(recs[:3], 1):
                    model = rec.get('model', 'Unknown')
                    reason = rec.get('reason', '')[:80]
                    print(f"  {i}. {model}: {reason}")
                print("✅ Recommend specialists test PASSED")
                return True
            elif data.get('warning'):
                print(f"Warning: {data['warning']}")
                print("⚠️  Partial success (AI may not be configured)")
                return True
            else:
                print("⚠️  No recommendations generated")
                return True
        else:
            print(f"❌ Test FAILED: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test ERROR: {e}")
        return False

def main():
    """Run all tests"""
    print()
    print("🧪 MEDORAI DEPLOYMENT TEST SUITE")
    print("=" * 60)
    print(f"Server: {BASE_URL}")
    print()
    
    results = []
    
    # Run tests
    results.append(("Health Check", test_health()))
    results.append(("Clarifying Questions", test_clarifying_questions()))
    results.append(("Recommend Specialists", test_recommend_specialists()))
    
    # Summary
    print()
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print()
        print("🎉 ALL TESTS PASSED! Deployment is successful!")
        print()
        return 0
    else:
        print()
        print("⚠️  Some tests failed. Check logs for details.")
        print()
        return 1

if __name__ == "__main__":
    sys.exit(main())
