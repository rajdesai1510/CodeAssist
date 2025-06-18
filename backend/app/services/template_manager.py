from pathlib import Path
from typing import List, Optional, Dict
import os
from app.models.template import Template, TemplateMatch
import logging
import requests
from dotenv import load_dotenv
import json
from .code_processor import CodeProcessor

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up Groq API for template matching
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
}
GROQ_MODEL = "llama-3.3-70b-versatile"

class TemplateManager:
    def __init__(self, templates_dir: str = "templates"):
        self.templates_dir = Path(templates_dir)
        self.templates: Dict[str, Template] = {}
        self.code_processor = CodeProcessor()
        self.load_templates()

    def load_templates(self):
        """Load all templates from the templates directory"""
        if not self.templates_dir.exists():
            logger.warning(f"Templates directory {self.templates_dir} does not exist")
            return

        for template_dir in self.templates_dir.iterdir():
            if not template_dir.is_dir():
                continue

            try:
                html_file = template_dir / "index.html"
                css_file = template_dir / "style.css"

                if not html_file.exists() or not css_file.exists():
                    logger.warning(f"Template {template_dir.name} is missing required files")
                    continue

                html_content = html_file.read_text(encoding='utf-8')
                css_content = css_file.read_text(encoding='utf-8')

                # Create template with just the name as description
                template = Template(
                    name=template_dir.name,
                    description=template_dir.name.replace("-", " ").replace("_", " "),
                    html_content=html_content,
                    css_content=css_content
                )
                self.templates[template_dir.name] = template
                logger.info(f"Loaded template: {template_dir.name}")

            except Exception as e:
                logger.error(f"Error loading template {template_dir.name}: {str(e)}")

    async def find_matching_template(self, prompt: str) -> Optional[TemplateMatch]:
        """Find the best matching template based on directory name and prompt content"""
        if not self.templates:
            return None
        try:
            # Create a simpler prompt for template matching that focuses on directory names
            template_names = "\n".join([
                f"- {template.name}"
                for template in self.templates.values()
            ])

            matching_prompt = f"""Given a user's request for a website and a list of available template categories, determine if the request matches any category.
            Consider ONLY the semantic meaning and purpose, not specific design elements.

            Available template categories:
            {template_names}

            User's request:
            {prompt}

            You must respond with ONLY a valid JSON object, no other text, using this exact format:
            {{
                "match": "exact_template_name",
                "score": 0.95,
                "confidence": 0.9
            }}

            Where:
            - match: must be one of the exact template names listed above, or "NO_MATCH"
            - score: a number between 0 and 1 indicating match quality
            - confidence: a number between 0 and 1 indicating confidence in the match

            Do not include any explanation or additional text, only the JSON object.
            """

            # Call Groq API for template matching
            payload = {
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a JSON-only response bot. You must return only valid JSON objects, no other text."},
                    {"role": "user", "content": matching_prompt}
                ],
                "temperature": 0.1,  # Lower temperature for more consistent JSON formatting
                "max_tokens": 500
            }

            response = requests.post(GROQ_API_URL, headers=GROQ_HEADERS, json=payload)
            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return None
                
            result = response.json()
            content = result['choices'][0]['message']['content'].strip()
            
            # Parse the JSON response
            match_result = json.loads(content)
            
            # Require a minimum match score for valid matches
            if match_result["match"] == "NO_MATCH" or match_result["score"] < 0.6:
                return None

            # Validate the response structure
            required_fields = ['match', 'score', 'confidence']
            if not all(field in match_result for field in required_fields):
                logger.error(f"Invalid response structure: {match_result}")
                return None

            # Validate match exists in templates
            if match_result['match'] != "NO_MATCH" and match_result['match'] not in self.templates:
                logger.error(f"Matched template '{match_result['match']}' not found in available templates")
                return None

            return TemplateMatch(
                template_name=match_result["match"],
                match_score=float(match_result["score"]),
                confidence=float(match_result["confidence"])
            )

        except Exception as e:
            logger.error(f"Error finding matching template: {str(e)}")
            return None

    def get_template(self, template_name: str) -> Optional[Template]:
        """Get a template by name"""
        return self.templates.get(template_name)

    def list_templates(self) -> List[str]:
        """List all available templates"""
        return list(self.templates.keys())

    async def process_template_with_requirements(self, template_name: str, user_requirements: str) -> Optional[Dict[str, str]]:
        """Process a template with user requirements"""
        template = self.get_template(template_name)
        if not template:
            return None

        try:
            return self.code_processor.process_template(template, user_requirements)
        except Exception as e:
            logger.error(f"Error processing template {template_name}: {str(e)}")
            return None 