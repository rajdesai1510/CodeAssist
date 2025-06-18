// React Agent functionality for CodeGen
const BASE_URL = 'http://localhost:8000';

// Store current state
let currentWorkspace = '';
let currentReactApp = '';

/**
 * Initialize the React agent UI
 */
function initReactAgentUI() {
    const reactAgentTab = document.getElementById('react-agent-tab');
    const reactAgentContent = document.getElementById('react-agent-content');
    
    if (!reactAgentTab || !reactAgentContent) {
        console.error('React agent UI elements not found');
        return;
    }
    
    reactAgentTab.addEventListener('click', () => {
        // Hide other content and show React agent content
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
        reactAgentContent.style.display = 'block';
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        reactAgentTab.classList.add('active');
    });
    
    // Initialize form handlers
    initCreateReactProjectForm();
    initTaskForm();
    initComponentForm();
    initModifyFileForm();
}

/**
 * Initialize the form for creating a new React project
 */
function initCreateReactProjectForm() {
    const form = document.getElementById('create-react-form');
    if (!form) {
        console.error('Create React project form not found');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceName = document.getElementById('react-workspace-name').value;
        const appName = document.getElementById('react-app-name').value;
        const description = document.getElementById('react-description').value;
        const componentsText = document.getElementById('react-components').value;
        const useTypescript = document.getElementById('react-typescript').checked;
        
        // Parse components
        const components = componentsText.split(',')
            .map(comp => comp.trim())
            .filter(comp => comp.length > 0);
        
        // Disable form and show loading
        toggleLoading(true, 'Creating React project...');
        
        try {
            const response = await fetch(`${BASE_URL}/agent/create-react-project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    app_name: appName,
                    description: description,
                    components: components,
                    use_typescript: useTypescript
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Update current workspace and app
                currentWorkspace = workspaceName;
                currentReactApp = appName;
                
                // Update UI with result
                showOutputResult(data.output);
                showSuccessMessage(`React project "${appName}" created successfully!`);
                
                // Update workspace selector
                updateWorkspaceSelector();
                
                // Reset form
                form.reset();
            } else {
                showErrorMessage(`Error creating React project: ${data.error}`);
            }
        } catch (error) {
            showErrorMessage(`Error: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    });
}

/**
 * Initialize the form for submitting custom tasks
 */
function initTaskForm() {
    const form = document.getElementById('task-form');
    if (!form) {
        console.error('Task form not found');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceName = document.getElementById('task-workspace-name').value;
        const task = document.getElementById('task-description').value;
        
        // Disable form and show loading
        toggleLoading(true, 'Running task...');
        
        try {
            const response = await fetch(`${BASE_URL}/agent/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    task: task
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Update current workspace
                currentWorkspace = workspaceName;
                
                // Update UI with result
                showOutputResult(data.output);
                showSuccessMessage('Task completed successfully!');
                
                // Reset form
                document.getElementById('task-description').value = '';
            } else {
                showErrorMessage(`Error running task: ${data.error}`);
            }
        } catch (error) {
            showErrorMessage(`Error: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    });
}

/**
 * Initialize the form for adding a new component
 */
function initComponentForm() {
    const form = document.getElementById('component-form');
    if (!form) {
        console.error('Component form not found');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceName = document.getElementById('component-workspace-name').value;
        const appName = document.getElementById('component-app-name').value;
        const componentName = document.getElementById('component-name').value;
        const description = document.getElementById('component-description').value;
        
        // Disable form and show loading
        toggleLoading(true, 'Creating component...');
        
        try {
            const response = await fetch(`${BASE_URL}/agent/add-component`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    app_name: appName,
                    component_name: componentName,
                    description: description
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Update current workspace and app
                currentWorkspace = workspaceName;
                currentReactApp = appName;
                
                // Update UI with result
                showOutputResult(data.output);
                showSuccessMessage(`Component "${componentName}" created successfully!`);
                
                // Reset form fields
                document.getElementById('component-name').value = '';
                document.getElementById('component-description').value = '';
            } else {
                showErrorMessage(`Error creating component: ${data.error}`);
            }
        } catch (error) {
            showErrorMessage(`Error: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    });
}

/**
 * Initialize the form for modifying a file
 */
function initModifyFileForm() {
    const form = document.getElementById('modify-file-form');
    if (!form) {
        console.error('Modify file form not found');
        return;
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceName = document.getElementById('modify-workspace-name').value;
        const appName = document.getElementById('modify-app-name').value;
        const filePath = document.getElementById('file-path').value;
        const instructions = document.getElementById('modify-instructions').value;
        
        // Disable form and show loading
        toggleLoading(true, 'Modifying file...');
        
        try {
            const response = await fetch(`${BASE_URL}/agent/modify-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    app_name: appName,
                    file_path: filePath,
                    instructions: instructions
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Update current workspace and app
                currentWorkspace = workspaceName;
                currentReactApp = appName;
                
                // Update UI with result
                showOutputResult(data.output);
                showSuccessMessage(`File "${filePath}" modified successfully!`);
                
                // Reset form fields
                document.getElementById('file-path').value = '';
                document.getElementById('modify-instructions').value = '';
            } else {
                showErrorMessage(`Error modifying file: ${data.error}`);
            }
        } catch (error) {
            showErrorMessage(`Error: ${error.message}`);
        } finally {
            toggleLoading(false);
        }
    });
}

/**
 * Update the workspace selector dropdowns
 */
async function updateWorkspaceSelector() {
    try {
        // Fetch workspaces from the server
        const response = await fetch(`${BASE_URL}/api/workspaces`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            const workspaces = data;
            
            // Update all workspace selectors
            const selectors = [
                'react-workspace-name',
                'task-workspace-name',
                'component-workspace-name',
                'modify-workspace-name'
            ];
            
            selectors.forEach(selectorId => {
                const selector = document.getElementById(selectorId);
                if (selector) {
                    // Clear existing options
                    selector.innerHTML = '';
                    
                    // Add workspaces as options
                    workspaces.forEach(workspace => {
                        const option = document.createElement('option');
                        option.value = workspace;
                        option.textContent = workspace;
                        selector.appendChild(option);
                    });
                    
                    // Select current workspace if available
                    if (currentWorkspace && workspaces.includes(currentWorkspace)) {
                        selector.value = currentWorkspace;
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error updating workspace selector:', error);
    }
}

/**
 * Show the agent output result in the UI
 */
function showOutputResult(output) {
    const outputElement = document.getElementById('agent-output');
    if (outputElement) {
        outputElement.textContent = output;
        outputElement.style.display = 'block';
    }
}

/**
 * Show a success message in the UI
 */
function showSuccessMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.textContent = message;
    
    // Add to the page
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) {
        messageContainer.innerHTML = '';
        messageContainer.appendChild(messageElement);
        
        // Remove after a delay
        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }
}

/**
 * Show an error message in the UI
 */
function showErrorMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'error-message';
    messageElement.textContent = message;
    
    // Add to the page
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) {
        messageContainer.innerHTML = '';
        messageContainer.appendChild(messageElement);
        
        // Remove after a delay
        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }
}

/**
 * Toggle loading state and message
 */
function toggleLoading(isLoading, message = '') {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        if (isLoading) {
            loadingElement.textContent = message;
            loadingElement.style.display = 'block';
        } else {
            loadingElement.style.display = 'none';
        }
    }
    
    // Disable/enable all form buttons
    const buttons = document.querySelectorAll('button[type="submit"]');
    buttons.forEach(button => {
        button.disabled = isLoading;
    });
}

// Export functions
export {
    initReactAgentUI,
    updateWorkspaceSelector
}; 