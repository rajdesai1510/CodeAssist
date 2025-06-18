// Define API URL
const API_URL = 'http://localhost:8000';

// DOM Elements
const workspaceSelector = document.getElementById('workspace-selector');
const workspaceNameInput = document.getElementById('workspace-name');
const newWorkspaceBtn = document.getElementById('new-workspace-btn');
const updateBtn = document.getElementById('update-btn');
const promptInput = document.getElementById('prompt-input');
const loadingOverlay = document.getElementById('loading-overlay');

// State
let currentWorkspace = '';
let currentFile = '';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Initialize application
async function initApp() {
    console.log('Initializing application...');
    
    // Show API check message
    const fileList = document.getElementById('file-list');
    if (fileList) {
        fileList.innerHTML = '<li>Checking backend connection...</li>';
    }
    
    // Add event listeners
    workspaceSelector.addEventListener('change', handleWorkspaceChange);
    newWorkspaceBtn.addEventListener('click', handleNewWorkspaceClick);
    updateBtn.addEventListener('click', handleUpdateFromPrompt);
    
    // Load workspaces on startup
    await loadWorkspaces();
    
    // Setup split panes if the function exists
    if (typeof Split === 'function') {
        setupSplitPanes();
    }
}

// Load workspaces from backend
async function loadWorkspaces() {
    console.log('Loading workspaces...');
    
    try {
        const fileList = document.getElementById('file-list');
        if (fileList) {
            fileList.innerHTML = '<li>Fetching workspaces from backend...</li>';
        }
        
        const response = await fetch(`${API_URL}/api/workspaces`);
        
        if (!response.ok) {
            throw new Error(`Failed to load workspaces: ${response.status}`);
        }
        
        const workspaces = await response.json();
        console.log('Workspaces loaded:', workspaces);
        
        if (fileList) {
            fileList.innerHTML = `<li>Found ${workspaces.length} workspaces: ${workspaces.join(', ')}</li>`;
        }
        
        // Clear current options except the first one
        while (workspaceSelector.options.length > 1) {
            workspaceSelector.remove(1);
        }
        
        // Add workspaces to selector
        if (workspaces && workspaces.length > 0) {
            workspaces.forEach(workspace => {
                const option = document.createElement('option');
                option.value = workspace;
                option.textContent = workspace;
                workspaceSelector.appendChild(option);
            });
        }
        
        return workspaces;
    } catch (error) {
        console.error('Error loading workspaces:', error);
        alert(`Error loading workspaces: ${error.message}`);
        
        const fileList = document.getElementById('file-list');
        if (fileList) {
            fileList.innerHTML = `<li class="error">Error connecting to backend: ${error.message}</li>
                                <li>Check that backend server is running at ${API_URL}</li>
                                <li>Check browser console for details</li>`;
        }
        
        return [];
    }
}

// Handle workspace change
async function handleWorkspaceChange() {
    const selectedWorkspace = workspaceSelector.value;
    console.log('Workspace changed to:', selectedWorkspace);
    
    if (!selectedWorkspace || selectedWorkspace === '-- Select Project --') return;
    
    currentWorkspace = selectedWorkspace;
    
    try {
        // Update workspace name display
        workspaceNameInput.value = selectedWorkspace;
        
        // Enable update button if a file is selected
        updateBtn.disabled = !currentFile;
        
        // Force file loading and log
        if (window.fileExplorerModule && window.fileExplorerModule.loadFilesForWorkspace) {
            window.fileExplorerModule.loadFilesForWorkspace(selectedWorkspace)
                .then(() => console.log('Files loaded for workspace:', selectedWorkspace))
                .catch(err => console.error('Error loading files for workspace:', err));
        } else {
            console.error('fileExplorerModule or loadFilesForWorkspace not available');
        }
        
        // Update preview
        if (window.previewModule) {
            window.previewModule.setWorkspace(selectedWorkspace);
        }
    } catch (error) {
        console.error('Error changing workspace:', error);
        alert(`Error loading workspace: ${error.message}`);
    }
}

// Handle new workspace button click
function handleNewWorkspaceClick() {
    // Show the welcome modal
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal) {
        welcomeModal.style.display = 'flex';
    }
}

// Handle updating file from prompt
async function handleUpdateFromPrompt() {
    if (!currentWorkspace || !currentFile) {
        alert('Please select a workspace and file first');
        return;
    }
    
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Please enter a description of the changes');
        return;
    }
    
    // Show loading overlay
    loadingOverlay.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/api/update-from-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspace_name: currentWorkspace,
                file_name: currentFile,
                prompt: prompt
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update file');
        }
        
        const data = await response.json();
        
        // Update editor with new content
        if (window.editorModule) {
            window.editorModule.setEditorContent(data.content);
        }
        
        // Update preview
        if (window.previewModule) {
            window.previewModule.refreshPreview();
        }
        
        // Clear prompt input
        promptInput.value = '';
        
        // Show success message
        alert('File updated successfully');
    } catch (error) {
        console.error('Error updating file:', error);
        alert(`Error updating file: ${error.message}`);
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.add('hidden');
    }
}

// Generate HTML/CSS project
async function generateProject(name, prompt) {
    if (!name || !prompt) {
        alert('Please enter a project name and description');
        return null;
    }
    
    try {
        // Show loading overlay
        loadingOverlay.classList.remove('hidden');
        
        const response = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspace_name: name,
                prompt: prompt
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate project');
        }
        
        const data = await response.json();
        console.log('Project generated:', data);
        
        // Refresh workspace list
        await loadWorkspaces();
        
        // Select the new workspace
        workspaceSelector.value = data.workspace_name;
        
        // Trigger workspace change
        await handleWorkspaceChange();
        
        return data;
    } catch (error) {
        console.error('Error generating project:', error);
        alert(`Error generating project: ${error.message}`);
        return null;
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.add('hidden');
    }
}

// Set current file
function setCurrentFile(fileName) {
    currentFile = fileName;
    updateBtn.disabled = !fileName;
}

// Split panes setup
function setupSplitPanes() {
    if (typeof Split === 'function') {
        Split({
            columnGutters: [{
                track: 1,
                element: document.querySelector('.file-explorer'),
            }, {
                track: 2,
                element: document.querySelector('.code-editor'),
            }],
            columnMinSize: 100,
        });
    }
}

// Export functions for use by other modules
window.appModule = {
    loadWorkspaces,
    getCurrentWorkspace: () => currentWorkspace,
    getCurrentFile: () => currentFile,
    setCurrentFile,
    generateProject,
    handleWorkspaceChange,
    handleNewWorkspaceClick,
    handleUpdateFromPrompt,
    setupSplitPanes
};