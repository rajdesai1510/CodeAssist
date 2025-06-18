from pydantic import BaseModel
from typing import Optional, List, Dict

class File(BaseModel):
    name: str
    content: str
    
class GenerationRequest(BaseModel):
    prompt: str
    workspace_name: str
    
class GenerationResponse(BaseModel):
    workspace_name: str
    files: List[File]

class UpdateFileRequest(BaseModel):
    workspace_name: str
    file_name: str
    content: str
    
class UpdatePromptRequest(BaseModel):
    workspace_name: str
    file_name: str
    prompt: str
    previous_code: Optional[str] = None
    workspace_description: Optional[str] = None
    chat_history: Optional[List[Dict[str, str]]] = None 