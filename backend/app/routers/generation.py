from fastapi import APIRouter, HTTPException, Body
from app.models.workspace import GenerationRequest, GenerationResponse, File, UpdateFileRequest, UpdatePromptRequest
from app.models.template import Template, TemplateMatch
from app.services.template_manager import TemplateManager
import os
from pathlib import Path
import shutil
from typing import List, Dict, Any
import logging
from dotenv import load_dotenv
import requests
import json

# Import the agent task handler
from ..agents.shell_agent import run_agent_task

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up Groq API
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY not found in environment variables")

# Groq API configuration
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
}
GROQ_MODEL = "llama-3.3-70b-versatile"  # You can also use "mixtral-8x7b-32768" or other Groq models

router = APIRouter(prefix="/api", tags=["generation"])

# Initialize template manager
template_manager = TemplateManager()

@router.post("/generate", response_model=GenerationResponse)
async def generate_code(request: GenerationRequest):
    """
    Generate HTML and CSS files based on prompt and create workspace
    """
    # Create workspace directory
    workspace_path = Path("workspaces") / request.workspace_name
    if workspace_path.exists():
        # If workspace exists, use a new name
        counter = 1
        while workspace_path.exists():
            workspace_path = Path("workspaces") / f"{request.workspace_name}_{counter}"
            counter += 1
    
    workspace_path.mkdir(parents=True, exist_ok=True)
    
    try:
        # First, try to find a matching template
        template_match = await template_manager.find_matching_template(request.prompt)
        
        if template_match:
            logger.info(f"Found matching template: {template_match.template_name} with score {template_match.match_score}")
            template = template_manager.get_template(template_match.template_name)
            
            if template:
                # Use template as base and modify it according to the prompt
                print("Template Matched")
                html_prompt = f"""
                Modify this existing HTML template to match the user's requirements:
                
                Original template HTML:
                ```html
                {template.html_content}
                ```
                
                User's requirements:
                {request.prompt}
                
                Return the modified HTML code only.
                Keep the same structure but update content, classes, and elements as needed.
                """
                
                css_prompt = f"""
                Modify this existing CSS template to match the user's requirements:
                
                Original template CSS:
                ```css
                {template.css_content}
                ```
                
                User's requirements:
                {request.prompt}
                
                Return the modified CSS code only.
                Keep the same structure but update styles, colors, and layouts as needed.
                """
                
        else:
            logger.info("No matching template found, generating from scratch")
            # Generate from scratch as before
            html_prompt = f"""
            Generate a clean, modern HTML file based on this description:
            {request.prompt}
            
            Include proper HTML5 structure with doctype, html, head, body tags.
            Add viewport meta tags and other necessary head elements.
            Only return the complete HTML code without any explanations.
            Use semantic HTML elements where appropriate.
            Add comments to explain the structure.
            Don't include any styling in the HTML file itself (no inline styles or style tags).
            Use class names that work well with CSS.
            Use Bootstrap Css and make the design interactive and user friendly.
            Use relevant icons from BootStrap in different sizes in place of images.
            """
            
        try:
            # Using Groq API for HTML generation
            payload = {
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a professional web developer who creates clean, semantic HTML using Bootstrap Css."},
                    {"role": "user", "content": html_prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 4000
            }
            
            response = requests.post(GROQ_API_URL, headers=GROQ_HEADERS, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {response.text}")
                
            response_data = response.json()
            html_content = response_data['choices'][0]['message']['content']
            
            # Clean up the response to extract just the HTML code
            if "```html" in html_content:
                html_content = html_content.split("```html")[1].split("```")[0].strip()
            elif "```" in html_content:
                html_content = html_content.split("```")[1].split("```")[0].strip()
                
            # Now, generate the CSS content
            if not template_match:
                css_prompt = f"""
                Generate a modern, clean CSS file for this HTML:
                ```html
                {html_content}
                ```
                
                Based on this description:
                {request.prompt}
                
                Create a responsive design that looks good on all devices.
                Use modern CSS features like flexbox and grid where appropriate.
                Add hover effects and transitions for interactive elements.
                Include media queries for responsive design.
                Add comments to explain the CSS sections.
                Only return the complete CSS code without any explanations.
                Use Bootstrap Css and make the design interactive and user friendly.
                Use relevant icons from BootStrap in different sizes in place of images.
                """
            
            # Using Groq API for CSS generation
            payload = {
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a professional web developer who creates clean, modern CSS using Bootstrap Css."},
                    {"role": "user", "content": css_prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 4000
            }
            
            response = requests.post(GROQ_API_URL, headers=GROQ_HEADERS, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {response.text}")
                
            response_data = response.json()
            css_content = response_data['choices'][0]['message']['content']
            
            # Clean up the response to extract just the CSS code
            if "```css" in css_content:
                css_content = css_content.split("```css")[1].split("```")[0].strip()
            elif "```" in css_content:
                css_content = css_content.split("```")[1].split("```")[0].strip()
                
            # Write the HTML and CSS files
            html_file_path = workspace_path / "index.html"
            css_file_path = workspace_path / "styles.css"
            
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_content)
                
            with open(css_file_path, "w", encoding="utf-8") as f:
                f.write(css_content)
                
            # Create a preview.html file that includes both HTML and CSS
            preview_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{request.workspace_name} - Preview</title>
    <style>
{css_content}
    </style>
</head>
<body>
{html_content}
</body>
</html>"""
            
            preview_path = workspace_path / "preview.html"
            with open(preview_path, "w", encoding="utf-8") as f:
                f.write(preview_html)
                
            # Create a README with instructions
            template_info = f"\nBased on template: {template_match.template_name}" if template_match else ""
            readme_content = f"""# {request.workspace_name}

This workspace contains a web project generated based on the following description:
{request.prompt}{template_info}

## Files
- index.html: The HTML structure of the website
- styles.css: The CSS styling for the website
- preview.html: A combined file with both HTML and CSS for easy previewing

## Preview
Open the preview.html file in a web browser to see the rendered website.
"""
            
            readme_path = workspace_path / "README.md"
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(readme_content)
                
            # Return the generated files
            files = [
                File(name="index.html", content=html_content),
                File(name="styles.css", content=css_content),
                File(name="README.md", content=readme_content)
            ]
            
            return GenerationResponse(
                workspace_name=workspace_path.name,
                files=files
            )
            
        except Exception as e:
            logger.error(f"Error during HTML/CSS generation: {e}")
            raise HTTPException(status_code=500, detail=f"Error during HTML/CSS generation: {str(e)}")
        
    except Exception as e:
        # Clean up in case of error
        if workspace_path.exists():
            shutil.rmtree(workspace_path)
        logger.error(f"Error generating HTML/CSS: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating HTML/CSS: {str(e)}")
        
@router.post("/update-file")
async def update_file(request: UpdateFileRequest):
    """
    Update file content in a workspace
    """
    workspace_path = Path("workspaces") / request.workspace_name
    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail=f"Workspace {request.workspace_name} not found")
    
    # Handle relative paths in the file name
    file_parts = request.file_name.split('/')
    file_path = workspace_path
    
    # Traverse the path to find the file
    for part in file_parts:
        file_path = file_path / part
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"message": f"File {request.file_name} updated successfully"}
    except Exception as e:
        logger.error(f"Error updating file: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating file: {str(e)}")
        
@router.post("/update-from-prompt")
async def update_from_prompt(request: UpdatePromptRequest):
    """
    Update file based on prompt using the agent
    """
    workspace_path = Path("workspaces") / request.workspace_name
    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail=f"Workspace {request.workspace_name} not found")

    # Handle relative paths in the file name
    file_parts = request.file_name.split('/')
    file_path = workspace_path
    for part in file_parts:
        file_path = file_path / part
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {request.file_name} not found")

    try:
        # If updating index.html or styles.css, regenerate both files
        if request.file_name in ["index.html", "styles.css"]:
            # Read previous HTML and CSS
            html_path = workspace_path / "index.html"
            css_path = workspace_path / "styles.css"
            prev_html = html_path.read_text(encoding="utf-8") if html_path.exists() else ""
            prev_css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

            # Build prompt for HTML and CSS update
            html_prompt = f"""
            Here is the previous index.html:
            ```html\n{prev_html}\n```
            Here is the previous styles.css:
            ```css\n{prev_css}\n```
            Update BOTH files according to this request:\n{request.prompt}\n
            Return ONLY the new index.html and styles.css code blocks.
            """
            # Build messages array, including chat_history if present
            messages = [
                {"role": "system", "content": "You are a professional web developer who updates HTML and CSS files together and uses only Bootstrap Css."}
            ]
            if request.chat_history:
                for msg in request.chat_history:
                    if "role" in msg and "content" in msg:
                        messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({"role": "user", "content": html_prompt})
            payload = {
                "model": GROQ_MODEL,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4000
            }
            response = requests.post(GROQ_API_URL, headers=GROQ_HEADERS, json=payload)
            if response.status_code != 200:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {response.text}")
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            # Extract new HTML and CSS from response
            import re
            html_match = re.search(r"```html(.*?)```", content, re.DOTALL)
            css_match = re.search(r"```css(.*?)```", content, re.DOTALL)
            new_html = html_match.group(1).strip() if html_match else prev_html
            new_css = css_match.group(1).strip() if css_match else prev_css
            # Save both files
            html_path.write_text(new_html, encoding="utf-8")
            css_path.write_text(new_css, encoding="utf-8")
            return {
                "message": "index.html and styles.css updated successfully",
                "files": [
                    {"name": "index.html", "content": new_html},
                    {"name": "styles.css", "content": new_css}
                ]
            }
        # Otherwise, fallback to previous logic
        # Read current file content
        with open(file_path, "r", encoding="utf-8") as f:
            current_content = f.read()
        
        # Build a task for the agent
        react_app_name = None
        # Try to find the React app name from directory structure
        for item in workspace_path.iterdir():
            if item.is_dir() and (item / "package.json").exists():
                react_app_name = item.name
                break
                
        if react_app_name:
            # If we found a React app dir, use agent to modify
            modification_task = f"""
            In the React application '{react_app_name}', modify the file '{request.file_name}' according to this request:
            {request.prompt}
            
            The current content of the file is:
            ```
            {current_content}
            ```
            """
            
            result = run_agent_task(str(workspace_path), modification_task)
            
            if not result["success"]:
                raise HTTPException(status_code=500, detail=f"Error modifying file: {result.get('error', 'Unknown error')}")
                
            # Read the updated content
            with open(file_path, "r", encoding="utf-8") as f:
                updated_content = f.read()
                
            return {
                "message": f"File {request.file_name} updated successfully",
                "files": [
                    {"name": request.file_name, "content": updated_content}
                ]
            }
        
        else:
            # Fall back to Groq API if React app not found
            # Generate updated content based on prompt
            prompt = f"""
            I have the following {request.file_name} file:
            ```
            {current_content}
            ```
            
            Please modify the file according to this request:
            {request.prompt}
            
            Return only the updated code.
            """
            
            try:
                # Using Groq API
                messages = [
                    {"role": "system", "content": "You are a helpful assistant that modifies code."}
                ]
                if request.chat_history:
                    for msg in request.chat_history:
                        if "role" in msg and "content" in msg:
                            messages.append({"role": msg["role"], "content": msg["content"]})
                messages.append({"role": "user", "content": prompt})
                payload = {
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 4000
                }
                
                response = requests.post(GROQ_API_URL, headers=GROQ_HEADERS, json=payload)
                
                if response.status_code != 200:
                    logger.error(f"Groq API error: {response.status_code} - {response.text}")
                    raise HTTPException(status_code=response.status_code, detail=f"Groq API error: {response.text}")
                    
                response_data = response.json()
                updated_content = response_data['choices'][0]['message']['content']
                
            except Exception as e:
                logger.error(f"Error calling Groq API: {e}")
                raise HTTPException(status_code=500, detail=f"Error updating file: {str(e)}")
            
            # Remove markdown code blocks if present
            if "```" in updated_content:
                if f"```{file_path.suffix[1:]}" in updated_content:
                    # If language-specific code block is found
                    updated_content = updated_content.split(f"```{file_path.suffix[1:]}")[1].split("```")[0].strip()
                else:
                    # Otherwise just get content between first and last ```
                    updated_content = updated_content.split("```", 2)[1]
                    if "```" in updated_content:
                        updated_content = updated_content.split("```")[0].strip()
            
            # Write updated content
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(updated_content)
            return {
                "message": f"File {request.file_name} updated successfully",
                "files": [
                    {"name": request.file_name, "content": updated_content}
                ]
            }
            
    except Exception as e:
        logger.error(f"Error updating file from prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating file from prompt: {str(e)}")

@router.get("/workspaces", response_model=List[str])
async def list_workspaces():
    """
    List all workspaces
    """
    workspaces_path = Path("workspaces")
    if not workspaces_path.exists():
        workspaces_path.mkdir(parents=True, exist_ok=True)
        
    workspaces = [d.name for d in workspaces_path.iterdir() if d.is_dir()]
    return workspaces

@router.get("/workspace/{workspace_name}/files", response_model=List[str])
async def list_workspace_files(workspace_name: str):
    """
    List all files in a workspace
    """
    workspace_path = Path("workspaces") / workspace_name
    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail=f"Workspace {workspace_name} not found")
    
    # Check if this is a React project
    react_app_dir = None
    for item in workspace_path.iterdir():
        if item.is_dir() and (item / "package.json").exists():
            react_app_dir = item
            break
    
    if react_app_dir:
        # If React app, get files from src directory
        files = []
        src_dir = react_app_dir / "src"
        if src_dir.exists():
            for file in src_dir.glob("**/*"):
                if file.is_file():
                    # Create relative path from workspace
                    rel_path = file.relative_to(workspace_path)
                    files.append(str(rel_path))
        
        # Add package.json and other important files
        for important_file in ["package.json", "README.md"]:
            file_path = react_app_dir / important_file
            if file_path.exists():
                rel_path = file_path.relative_to(workspace_path)
                files.append(str(rel_path))
                
        return files
    else:
        # Regular workspace - list all files recursively
        files = []
        for file in workspace_path.glob("**/*"):
            if file.is_file():
                # Create relative path from workspace
                rel_path = file.relative_to(workspace_path)
                files.append(str(rel_path))
        return files

@router.get("/workspace/{workspace_name}/file/{file_name:path}")
async def get_file_content(workspace_name: str, file_name: str):
    """
    Get content of a file, supporting nested paths
    """
    workspace_path = Path("workspaces") / workspace_name
    if not workspace_path.exists():
        raise HTTPException(status_code=404, detail=f"Workspace {workspace_name} not found")
    
    # Handle paths with slashes
    file_path = workspace_path / Path(file_name)
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {file_name} not found")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"name": file_name, "content": content}
    except Exception as e:
        logger.error(f"Error reading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.get("/workspace/list")
async def list_workspaces_compat():
    """
    List all available workspaces (backward compatibility)
    """
    try:
        workspaces_dir = Path("workspaces")
        if not workspaces_dir.exists():
            workspaces_dir.mkdir(parents=True)
            
        # Get all directories in workspaces directory
        workspaces = [d.name for d in workspaces_dir.iterdir() if d.is_dir()]
        
        return {
            "success": True,
            "workspaces": workspaces
        }
        
    except Exception as e:
        logger.error(f"Error listing workspaces: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/generate", response_model=GenerationResponse)
async def generate_code_compat(request: GenerationRequest):
    """
    Generate code based on prompt (backward compatibility)
    """
    return await generate_code(request)

@router.post("/update-from-prompt")
async def update_from_prompt_compat(request: UpdatePromptRequest):
    """
    Update file based on prompt (backward compatibility)
    """
    return await update_from_prompt(request) 