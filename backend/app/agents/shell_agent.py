import os
import subprocess
import sys
import tempfile
from pathlib import Path
import logging
import json
import shutil
from typing import List, Dict, Any, Optional, Type, Union, Callable
from langchain.agents import tool
from langchain.agents import AgentExecutor
from langchain_community.agent_toolkits.base import BaseToolkit
from langchain_community.tools.file_management.write import WriteFileTool
from langchain_community.tools.file_management.read import ReadFileTool
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain.agents.format_scratchpad.tools import format_to_tool_messages
from langchain.agents.output_parsers.tools import ToolsAgentOutputParser
from langchain_groq import ChatGroq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get Groq API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY not found in environment variables")

# Custom Shell Tool implementation
class ShellTool(BaseTool):
    """Tool to run shell commands."""
    
    name: str = "shell"
    description: str = """
    Executes shell commands and returns the output.
    Use this when you need to run commands in the system's shell.
    """
    return_direct: bool = False
    
    def _run(self, command: str) -> str:
        """Run the shell command and return the output."""
        try:
            logger.info(f"Running shell command: {command}")
            result = subprocess.run(
                command, 
                shell=True, 
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Combine stdout and stderr
            output = result.stdout
            if result.stderr:
                if output:
                    output += "\n" + result.stderr
                else:
                    output = result.stderr
                    
            if result.returncode != 0:
                output += f"\nCommand exited with return code {result.returncode}"
                
            return output
        except Exception as e:
            return f"Error running command: {str(e)}"
    
    async def _arun(self, command: str) -> str:
        """Run the shell command asynchronously."""
        return self._run(command)

class CreateReactAppInput(BaseModel):
    """Inputs for creating a React app"""
    workspace_dir: str = Field(..., description="Directory where to create the React app")
    app_name: str = Field(..., description="Name of the React application")
    use_typescript: bool = Field(False, description="Whether to use TypeScript")

@tool
def create_react_app(workspace_dir: str, app_name: str, use_typescript: bool = False) -> str:
    """
    Creates a new React application using create-react-app in the specified workspace directory.
    
    Args:
        workspace_dir: Directory where to create the React app
        app_name: Name of the React application
        use_typescript: Whether to use TypeScript (defaults to False)
    
    Returns:
        A message indicating the result of the operation
    """
    try:
        workspace_path = Path(workspace_dir)
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True)
        
        # Change to workspace directory
        original_dir = os.getcwd()
        os.chdir(workspace_path)
        
        # Build the command
        cmd = ["npx", "create-react-app", app_name]
        if use_typescript:
            cmd.append("--template=typescript")
            
        # Run the command
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Return to original directory
        os.chdir(original_dir)
        
        if result.returncode == 0:
            return f"Successfully created React app '{app_name}' in {workspace_dir}"
        else:
            return f"Error creating React app: {result.stderr}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def install_react_dependencies(workspace_dir: str, app_name: str, packages: List[str]) -> str:
    """
    Installs npm packages in the React application.
    
    Args:
        workspace_dir: Directory where the React app is located
        app_name: Name of the React application
        packages: List of npm packages to install
    
    Returns:
        A message indicating the result of the operation
    """
    try:
        app_path = Path(workspace_dir) / app_name
        if not app_path.exists():
            return f"Error: React app '{app_name}' not found in {workspace_dir}"
        
        # Change to app directory
        original_dir = os.getcwd()
        os.chdir(app_path)
        
        # Build the command
        cmd = ["npm", "install", "--save"]
        cmd.extend(packages)
            
        # Run the command
        logger.info(f"Running command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Return to original directory
        os.chdir(original_dir)
        
        if result.returncode == 0:
            return f"Successfully installed packages {', '.join(packages)} in React app '{app_name}'"
        else:
            return f"Error installing packages: {result.stderr}"
    except Exception as e:
        return f"Error: {str(e)}"

@tool
def create_react_component(workspace_dir: str, app_name: str, component_name: str, component_code: str, is_typescript: bool = False) -> str:
    """
    Creates a new React component file in the React application.
    
    Args:
        workspace_dir: Directory where the React app is located
        app_name: Name of the React application
        component_name: Name of the component to create
        component_code: The code content for the component
        is_typescript: Whether the component is TypeScript
    
    Returns:
        A message indicating the result of the operation
    """
    try:
        app_path = Path(workspace_dir) / app_name / "src" / "components"
        if not app_path.exists():
            app_path.mkdir(parents=True)
        
        # Determine file extension
        ext = ".tsx" if is_typescript else ".jsx"
        
        # Create component file
        component_path = app_path / f"{component_name}{ext}"
        with open(component_path, "w", encoding="utf-8") as f:
            f.write(component_code)
        
        return f"Successfully created component '{component_name}' in {component_path}"
    except Exception as e:
        return f"Error creating component: {str(e)}"

@tool
def modify_react_app(workspace_dir: str, app_name: str, file_path: str, file_content: str) -> str:
    """
    Modifies a file in the React application.
    
    Args:
        workspace_dir: Directory where the React app is located
        app_name: Name of the React application
        file_path: Path to the file relative to the app's root
        file_content: The new content for the file
    
    Returns:
        A message indicating the result of the operation
    """
    try:
        full_path = Path(workspace_dir) / app_name / file_path
        parent_dir = full_path.parent
        
        if not parent_dir.exists():
            parent_dir.mkdir(parents=True)
        
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(file_content)
        
        return f"Successfully modified file '{file_path}' in React app"
    except Exception as e:
        return f"Error modifying file: {str(e)}"

class ReactToolkit(BaseToolkit):
    """Toolkit for working with React applications"""
    
    def get_tools(self) -> List[BaseTool]:
        """Return the tools in the toolkit."""
        return [
            create_react_app,
            install_react_dependencies,
            create_react_component,
            modify_react_app,
            ShellTool(),
            WriteFileTool(),
            ReadFileTool()
        ]

def create_react_agent(workspace_dir: str) -> AgentExecutor:
    """
    Creates a LangChain agent that can work with React applications
    
    Args:
        workspace_dir: Directory where the agent will operate
    
    Returns:
        An AgentExecutor instance
    """
    # Initialize the LLM
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model="llama3-8b-8192",
        temperature=0.2
    )
    
    # Get tools
    toolkit = ReactToolkit()
    tools = toolkit.get_tools()
    
    # Create the system message
    system_message = """You are an expert React developer assistant. You help users create, modify, and manage React applications.
        
Your capabilities:
1. Create new React applications
2. Install npm packages
3. Create and modify React components
4. Execute shell commands when necessary
5. Read and write files

When creating React components, follow these best practices:
- Use functional components with hooks
- Follow the React component naming convention (PascalCase)
- Include prop validation
- Organize imports properly
- Add meaningful comments

When working with files, be careful to use the correct paths and check if directories exist before creating files.

Workspace directory: {workspace_dir}

Tools:
{tools}

Always verify that your code would run correctly before returning it.
"""
    
    # Create the prompt template with the updated format
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=system_message),
        HumanMessage(content="{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad")
    ])
    
    # Create the agent
    agent = (
        {
            "input": lambda x: x["input"],
            "agent_scratchpad": lambda x: format_to_tool_messages(x["intermediate_steps"]),
            "workspace_dir": lambda x: workspace_dir,
            "tools": lambda x: "\n".join([f"{tool.name}: {tool.description}" for tool in tools])
        }
        | prompt
        | llm
        | ToolsAgentOutputParser()
    )
    
    # Create the agent executor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True
    )
    
    return agent_executor

def run_agent_task(workspace_dir: str, task: str) -> Dict[str, Any]:
    """
    Runs a task using the React agent
    
    Args:
        workspace_dir: Directory where the agent will operate
        task: The task description for the agent
    
    Returns:
        A dictionary with the task result and any output
    """
    try:
        agent = create_react_agent(workspace_dir)
        result = agent.invoke({"input": task})
        
        return {
            "success": True,
            "output": result["output"],
            "workspace_dir": workspace_dir
        }
    except Exception as e:
        logger.error(f"Error running agent task: {e}")
        return {
            "success": False,
            "error": str(e),
            "workspace_dir": workspace_dir
        } 