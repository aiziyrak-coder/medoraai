"""
Mukammal Gemini AI Integration
Farg'ona jamoat salomatligi tibbiyot instituti (FJSTI)

All AI services powered exclusively by Google Gemini API
"""
import json
import logging
from typing import Dict, List, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

try:
   from google import genai
   from google.genai.types import GenerateContentConfig, SafetySetting, HarmCategory, HarmBlockThreshold
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.error("google-genai not installed. Run: pip install google-genai")


class GeminiAIService:
    """
    Mukammal Gemini AI Service - barcha tibbiy AI vazifalar uchun
    """
    
   def __init__(self):
        self.client = None
        self.api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self.model_flash = getattr(settings, 'GEMINI_MODEL_FLASH', 'gemini-2.0-flash-exp')
        self.model_pro = getattr(settings, 'GEMINI_MODEL_PRO', 'gemini-1.5-pro')
        self.model_thinking = getattr(settings, 'GEMINI_MODEL_THINKING', 'gemini-2.0-flash-thinking-exp')
        self._initialize_client()
    
   def _initialize_client(self):
        """Initialize Gemini client with API key"""
       if not GEMINI_AVAILABLE:
            logger.error("Google GenAI library not available")
           return
        
       if not self.api_key or not self.api_key.strip():
            logger.error("Gemini API key not configured in settings")
           return
        
       try:
            self.client = genai.Client(api_key=self.api_key.strip())
            logger.info(f"Gemini AI initialized successfully (Flash: {self.model_flash}, Pro: {self.model_pro})")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
    
   def generate_response(
        self,
        prompt: str,
       model: str = 'flash',
        temperature: float = 0.1,
       max_tokens: int = 8192,
        system_instruction: Optional[str] = None,
       response_format: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate response using Gemini AI
        
        Args:
            prompt: Input text/prompt
           model: 'flash', 'pro', or 'thinking'
            temperature: 0.0-2.0 (lower = more focused)
           max_tokens: Maximum tokens to generate
            system_instruction: System context/instructions
           response_format: 'json' for JSON output
            
        Returns:
            Generated text response
        """
       if not self.client:
            raise RuntimeError("Gemini AI not initialized. Check GEMINI_API_KEY in settings.")
        
        # Select model
       if model == 'pro':
           model_name = self.model_pro
        elif model == 'thinking':
           model_name = self.model_thinking
        else:
           model_name = self.model_flash
        
        # Build configuration
        config_dict = {
            'temperature': temperature,
            'max_output_tokens': max_tokens,
        }
        
       if system_instruction:
            config_dict['system_instruction'] = system_instruction
            
       if response_format == 'json':
            config_dict['response_mime_type'] = 'application/json'
        
       try:
            # Prepare content
            content = prompt
           if system_instruction and model != 'thinking':
                content = f"{system_instruction}\n\n{prompt}"
            
            # Generate content
           response = self.client.models.generate_content(
               model=model_name,
                contents=content,
                config=GenerateContentConfig(**config_dict) if config_dict else None
            )
            
            # Extract text from response
           return self._extract_text(response)
            
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            raise
    
   def generate_structured(
        self,
        prompt: str,
        schema: Dict[str, Any],
       model: str = 'flash',
        system_instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate structured JSON response
        
        Args:
            prompt: Input prompt
            schema: Expected JSON schema structure
           model: Model to use
            system_instruction: Context instructions
            
        Returns:
            Parsed JSON dictionary
        """
       try:
           response_text = self.generate_response(
                prompt=prompt,
               model=model,
                system_instruction=system_instruction,
               response_format='json'
            )
            
            # Parse JSON
           result = json.loads(response_text)
           return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            # Fallback: try to extract JSON from text
           return self._extract_json_from_text(response_text)
        except Exception as e:
            logger.error(f"Structured generation error: {e}")
            raise
    
   def analyze_medical_case(
        self,
       patient_data: Dict[str, Any],
        analysis_type: str = 'comprehensive',
        language: str = 'uz'
    ) -> Dict[str, Any]:
        """
        Analyze medical case using Gemini
        
        Args:
           patient_data: Patient information dictionary
            analysis_type: 'quick', 'diagnosis', 'treatment', 'comprehensive'
            language: Response language ('uz', 'ru', 'en')
            
        Returns:
            Analysis results dictionary
        """
        # Build medical context
        context = self._build_medical_context(patient_data, language)
        
        # Define analysis prompts
        prompts = {
            'quick': "Tezkor tibbiy maslahat bering. Asosiy tashxis va tavsiyalar.",
            'diagnosis': "Batafsil differensial tashxis qiling. ICD-10 kodlari bilan.",
            'treatment': "Davolash rejasi: dorilar, dozalar, davomiyligi.",
            'comprehensive': "To'liq tibbiy konsilium: tashxis, tekshiruvlar, davolash, prognoz."
        }
        
        system_instruction = f"""Siz professional tibbiy AI yordamchisiz. Farg'ona Jamoat Salomatligi Tibbiyot Instituti uchun ishlayapsiz.
Javoblar aniq, ilmiy asoslangan va amaliy bo'lishi kerak. Barcha javoblar o'zbek tilida."""
        
        prompt = f"{context}\n\nVazifa: {prompts.get(analysis_type, prompts['comprehensive'])}"
        
       try:
           result = self.generate_structured(
                prompt=prompt,
                schema=self._get_analysis_schema(analysis_type),
               model='pro' if analysis_type == 'comprehensive' else 'flash',
                system_instruction=system_instruction
            )
           return result
        except Exception as e:
            logger.error(f"Medical analysis failed: {e}")
            raise
    
   def _build_medical_context(self, patient_data: Dict[str, Any], language: str) -> str:
        """Build comprehensive medical context from patient data"""
        d = patient_data
        
        lines = [
            f"Bemor ma'lumotlari:",
            f"Ism: {d.get('firstName', '')} {d.get('lastName', '')}",
            f"Yosh: {d.get('age', '?')} yosh",
            f"Jinsi: {d.get('gender', '?')}",
            "",
            "Asosiy shikoyatlar:",
            d.get('complaints', 'Ma\'lumot yo\'q'),
            "",
            "Kasallik tarixi:",
            d.get('history', 'Ma\'lumot yo\'q'),
            "",
            "Ob'ektiv ma'lumotlar:",
            d.get('objectiveData', 'Ma\'lumot yo\'q'),
        ]
        
       if d.get('labResults'):
            lines.extend(["", "Laboratoriya natijalari:", d.get('labResults', '')])
        
       if d.get('allergies'):
            lines.extend(["", "Allergiyalar:", d.get('allergies', '')])
        
       if d.get('currentMedications'):
            lines.extend(["", "Joriy dorilar:", d.get('currentMedications', '')])
        
       if d.get('familyHistory'):
            lines.extend(["", "Oila anamnezi:", d.get('familyHistory', '')])
        
       return "\n".join(lines)
    
   def _extract_text(self, response) -> str:
        """Extract text from Gemini response"""
       if not response:
           return ""
        
        # Try direct text attribute
        text = getattr(response, 'text', None)
       if text and str(text).strip():
           return str(text).strip()
        
        # Try candidates
        candidates = getattr(response, 'candidates', []) or []
       if candidates:
            content = getattr(candidates[0], 'content', None)
           if content:
               parts = getattr(content, 'parts', []) or []
               if parts:
                    texts = [getattr(p, 'text', '') for p in parts if hasattr(p, 'text')]
                   return ''.join(texts).strip()
        
       return ""
    
   def _extract_json_from_text(self, text: str) -> Dict[str, Any]:
        """Try to extract JSON from text response"""
       import re
       try:
            # Find JSON block
            json_match = re.search(r'\{[\s\S]*\}', text)
           if json_match:
               return json.loads(json_match.group())
        except:
           pass
       return {'error': 'Failed to parse response', 'raw': text}
    
   def _get_analysis_schema(self, analysis_type: str) -> Dict[str, Any]:
        """Get JSON schema for analysis type"""
        schemas = {
            'quick': {
                'type': 'object',
                'properties': {
                    'diagnosis': {'type': 'string'},
                    'recommendations': {'type': 'array', 'items': {'type': 'string'}},
                    'urgency': {'type': 'string', 'enum': ['low', 'medium', 'high', 'emergency']}
                }
            },
            'diagnosis': {
                'type': 'object',
                'properties': {
                    'primary_diagnosis': {'type': 'string'},
                    'icd10_code': {'type': 'string'},
                    'differential_diagnoses': {'type': 'array', 'items': {'type': 'string'}},
                    'confidence': {'type': 'number'},
                    'reasoning': {'type': 'string'}
                }
            },
            'comprehensive': {
                'type': 'object',
                'properties': {
                    'diagnoses': {'type': 'array', 'items': {'type': 'object'}},
                    'tests_recommended': {'type': 'array', 'items': {'type': 'string'}},
                    'treatment_plan': {'type': 'object'},
                    'follow_up': {'type': 'string'},
                    'red_flags': {'type': 'array', 'items': {'type': 'string'}}
                }
            }
        }
       return schemas.get(analysis_type, schemas['quick'])


# Global instance
_gemini_service = None

def get_gemini_service() -> GeminiAIService:
    """Get singleton Gemini AI service instance"""
    global_gemini_service
   if _gemini_service is None:
        _gemini_service = GeminiAIService()
   return_gemini_service


# Convenience functions
def analyze_patient(patient_data: Dict[str, Any], analysis_type: str = 'comprehensive') -> Dict[str, Any]:
    """Quick patient analysis using Gemini"""
    service = get_gemini_service()
   return service.analyze_medical_case(patient_data, analysis_type)


def generate_medical_text(prompt: str, model: str = 'flash') -> str:
    """Generate medical text response"""
    service = get_gemini_service()
   return service.generate_response(prompt, model)


def generate_structured_response(prompt: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Generate structured JSON response"""
    service = get_gemini_service()
   return service.generate_structured(prompt, schema)
