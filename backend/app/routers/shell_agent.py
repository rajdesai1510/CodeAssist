from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os
import shutil
from pathlib import Path
import logging
import json
from ..agents.shell_agent import run_agent_task

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class AgentTaskRequest(BaseModel):
    workspace_name: str
    task: str

class CreateReactProjectRequest(BaseModel):
    workspace_name: str
    app_name: str
    description: Optional[str] = None
    components: Optional[List[str]] = None
    use_typescript: bool = False

@router.post("/agent/run")
async def run_task(request: AgentTaskRequest):
    """
    Run an agent task in a workspace
    """
    try:
        # Get workspace directory
        workspace_dir = os.path.join("workspaces", request.workspace_name)
        
        # Ensure workspace exists
        if not os.path.exists(workspace_dir):
            os.makedirs(workspace_dir)
            
        # Run the agent task
        result = run_agent_task(workspace_dir, request.task)
        
        if result["success"]:
            return {
                "success": True,
                "workspace_name": request.workspace_name,
                "output": result["output"]
            }
        else:
            return {
                "success": False,
                "workspace_name": request.workspace_name,
                "error": result.get("error", "Unknown error")
            }
            
    except Exception as e:
        logger.error(f"Error running agent task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/create-react-project")
async def create_react_project(request: CreateReactProjectRequest):
    """
    Create a new React project in a workspace
    """
    try:
        # Get workspace directory
        workspace_dir = os.path.join("workspaces", request.workspace_name)
        
        # Ensure workspace exists
        if not os.path.exists(workspace_dir):
            os.makedirs(workspace_dir)
            
        # Build the task description
        task = f"Create a new React application named {request.app_name}"
        
        if request.use_typescript:
            task += " using TypeScript"
            
        if request.description:
            task += f" with the following description: {request.description}"
            
        if request.components and len(request.components) > 0:
            components_str = ", ".join(request.components)
            task += f". Include the following components: {components_str}"
            
        # Run the agent task
        result = run_agent_task(workspace_dir, task)
        
        if result["success"]:
            return {
                "success": True,
                "workspace_name": request.workspace_name,
                "app_name": request.app_name,
                "output": result["output"]
            }
        else:
            return {
                "success": False,
                "workspace_name": request.workspace_name,
                "error": result.get("error", "Unknown error")
            }
            
    except Exception as e:
        logger.error(f"Error creating React project: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/add-component")
async def add_component(
    workspace_name: str = Body(...),
    app_name: str = Body(...),
    component_name: str = Body(...),
    description: str = Body(...)
):
    """
    Add a new component to a React application
    """
    try:
        # Get workspace directory
        workspace_dir = os.path.join("workspaces", workspace_name)
        
        # Ensure workspace and app exist
        app_path = os.path.join(workspace_dir, app_name)
        if not os.path.exists(app_path):
            raise HTTPException(status_code=404, detail=f"React app '{app_name}' not found in workspace '{workspace_name}'")
            
        # Build the task description
        task = f"Create a new React component named {component_name} for the {app_name} application with the following description: {description}"
            
        # Run the agent task
        result = run_agent_task(workspace_dir, task)
        
        if result["success"]:
            return {
                "success": True,
                "workspace_name": workspace_name,
                "app_name": app_name,
                "component_name": component_name,
                "output": result["output"]
            }
        else:
            return {
                "success": False,
                "workspace_name": workspace_name,
                "error": result.get("error", "Unknown error")
            }
            
    except Exception as e:
        logger.error(f"Error adding component: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/modify-file")
async def modify_file(
    workspace_name: str = Body(...),
    app_name: str = Body(...),
    file_path: str = Body(...),
    instructions: str = Body(...)
):
    """
    Modify a file in a React application
    """
    try:
        # Get workspace directory
        workspace_dir = os.path.join("workspaces", workspace_name)
        
        # Ensure workspace and app exist
        app_path = os.path.join(workspace_dir, app_name)
        if not os.path.exists(app_path):
            raise HTTPException(status_code=404, detail=f"React app '{app_name}' not found in workspace '{workspace_name}'")
            
        full_file_path = os.path.join(app_path, file_path)
        if not os.path.exists(full_file_path):
            raise HTTPException(status_code=404, detail=f"File '{file_path}' not found in app '{app_name}'")
            
        # Build the task description
        task = f"Modify the file at '{file_path}' in the '{app_name}' React application according to these instructions: {instructions}"
            
        # Run the agent task
        result = run_agent_task(workspace_dir, task)
        
        if result["success"]:
            return {
                "success": True,
                "workspace_name": workspace_name,
                "app_name": app_name,
                "file_path": file_path,
                "output": result["output"]
            }
        else:
            return {
                "success": False,
                "workspace_name": workspace_name,
                "error": result.get("error", "Unknown error")
            }
            
    except Exception as e:
        logger.error(f"Error modifying file: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 