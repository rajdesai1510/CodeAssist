from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

from app.routers import generation
from app.routers import shell_agent

# Load environment variables
load_dotenv()

# Create app
app = FastAPI(title="CodeGen Web App")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers - Note: generation router already has prefix="/api"
app.include_router(generation.router)
app.include_router(shell_agent.router)

# Create workspaces directory if it doesn't exist
workspaces_dir = Path("workspaces")
if not workspaces_dir.exists():
    workspaces_dir.mkdir(parents=True)

# Create agents directory if it doesn't exist
agents_dir = Path("app/agents")
if not agents_dir.exists():
    agents_dir.mkdir(parents=True)

# Mount workspaces directory for serving static files
app.mount("/workspaces", StaticFiles(directory="workspaces"), name="workspaces")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 