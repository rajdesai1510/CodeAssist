# CodeGen - HTML/CSS Generator Web App

A web application that generates HTML and CSS code from text prompts using AI. It features a file explorer, code editor, and live preview. It also includes a React Builder that can create React applications using LangChain's shell agent.

## Features

- Generate HTML and CSS from text prompts
- Edit code directly in the browser
- Live preview of generated websites
- AI-powered code modifications using Groq API
- Workspace management for multiple projects
- Create React applications with an intelligent shell agent
- Add React components with natural language descriptions
- Modify React files with AI assistance

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── agents/        # LangChain agents
│   │   ├── models/        # Pydantic models
│   │   ├── routers/       # API endpoints
│   │   └── main.py        # FastAPI application
│   ├── workspaces/        # Generated code workspaces
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── css/
│   │   ├── styles.css     # Main application styles
│   │   ├── split-pane.css # Resizable panel styles
│   │   ├── modal.css      # Modal styles
│   │   └── react-agent.css # React agent UI styles
│   ├── js/
│   │   ├── app.js         # Main application logic
│   │   ├── editor.js      # Code editor functionality
│   │   ├── preview.js     # Live preview functionality
│   │   ├── file-explorer.js # File explorer functionality
│   │   ├── modal.js       # Welcome modal functionality
│   │   └── react-agent.js # React builder functionality
│   └── index.html         # Main HTML file
└── README.md              # This file
```

## Setup Instructions

### Backend Setup

1. Install Python 3.8+ if not already installed
2. Navigate to the backend directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Create a `.env` file with your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
   You must get an API key from Groq's website: https://console.groq.com/keys

5. Start the backend server:
   ```
   uvicorn app.main:app --reload
   ```

### Environment Setup Note

If using Python 3.12, you might encounter some compatibility issues. In that case:
- Use Python 3.10 or 3.11 instead
- Or create a virtual environment to install dependencies in an isolated environment:
  ```
  python -m venv venv
  venv\Scripts\activate  # Windows
  source venv/bin/activate  # Linux/Mac
  pip install -r requirements.txt
  ```

### Frontend Setup

1. Open a new terminal
2. Serve the frontend directory using any static file server. For example, using Python's built-in server:
   ```
   cd frontend
   python -m http.server 3000
   ```
   Or using Node.js with `http-server`:
   ```
   npm install -g http-server
   cd frontend
   http-server -p 3000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## How to Use

### HTML/CSS Generator

1. Enter a workspace name in the top-right input field
2. Enter a prompt in the bottom text area describing what you want to create
3. Click "Generate New" to create a new project
4. Edit the generated files in the code editor
5. Use the "Update Current File" button to modify the code with AI assistance
6. View the live preview on the right panel
7. Save changes with the Save button

### React Builder

1. Click on the "React Builder" tab at the top of the page
2. Use the following panels to create and manage React applications:
   - **Create New React Project**: Create a new React app in a workspace with optional TypeScript support
   - **Add Component**: Add new React components to an existing project
   - **Modify File**: Update any file in a React project with natural language instructions
   - **Custom Task**: Perform custom tasks within a React project workspace

## About LangChain Shell Agent

The application uses a LangChain agent to interact with the system shell for creating and modifying React applications. This agent can:

1. Create new React applications using `create-react-app`
2. Install npm packages
3. Create functional React components based on descriptions
4. Modify existing React files
5. Execute custom shell commands when needed

The agent is powered by the Groq LLM for intelligent decision-making and leverages LangChain's toolkit architecture with custom React-specific tools.

## About Groq API

This application uses the Groq API for generating and modifying code. Groq offers high-performance language models with very low latency. The application uses the "llama3-8b-8192" model by default, but you can change this to other available models like "mixtral-8x7b-32768" by editing the `GROQ_MODEL` variable in `backend/app/routers/generation.py`.

## Technologies Used

- **Backend**:
  - FastAPI
  - Python 3.8+
  - Groq API for code generation
  - LangChain for agent-based operations
  
- **Frontend**:
  - HTML/CSS/JavaScript
  - CodeMirror editor
  - Split.js for resizable panels
  - Font Awesome for icons 