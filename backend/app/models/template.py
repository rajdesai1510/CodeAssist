from pydantic import BaseModel
from typing import Optional, List

class Template(BaseModel):
    name: str
    description: str
    html_content: str
    css_content: str

class TemplateMatch(BaseModel):
    template_name: str
    match_score: float  # Score between 0 and 1 indicating how well the template matches
    confidence: float  # Confidence in the match 