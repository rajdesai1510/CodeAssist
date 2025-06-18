// Modal functionality
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing modal...');
    
    // DOM Elements
    const welcomeModal = document.getElementById('welcome-modal');
    const newWorkspaceBtn = document.getElementById('new-workspace-btn');
    const createWorkspaceBtn = document.getElementById('create-workspace-btn');
    const openWorkspaceBtn = document.getElementById('open-workspace-btn');
    const existingWorkspaceSelect = document.getElementById('existing-workspace-select');
    const newWorkspaceName = document.getElementById('new-workspace-name');
    const newWorkspacePrompt = document.getElementById('new-workspace-prompt');
    const modalTabs = document.querySelectorAll('.modal-tab');
    const modalTabContents = document.querySelectorAll('.modal-tab-content');
    const API_URL = 'http://localhost:8000';
    
    // Show welcome modal on load if no workspace is selected
    if (window.location.search.indexOf('skip_modal=true') === -1) {
        console.log('Showing welcome modal on load');
        showWelcomeModal();
    } else {
        console.log('Skipping welcome modal on load');
        welcomeModal.style.display = 'none';
    }
    
    // Event Listeners
    newWorkspaceBtn.addEventListener('click', showWelcomeModal);
    createWorkspaceBtn.addEventListener('click', handleCreateWorkspace);
    openWorkspaceBtn.addEventListener('click', handleOpenWorkspace);
    existingWorkspaceSelect.addEventListener('change', handleExistingWorkspaceSelection);
    
    // Modal tab switching
    modalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            console.log(`Tab clicked: ${tab.getAttribute('data-tab')}`);
            
            // Update active tab
            modalTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            const tabId = tab.getAttribute('data-tab');
            modalTabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-content`) {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // Show welcome modal
    function showWelcomeModal() {
        console.log('Loading existing workspaces for modal...');
        
        // Load existing workspaces
        loadExistingWorkspaces();
        
        // Display the modal
        welcomeModal.style.display = 'flex';
        
        // Reset form fields
        newWorkspaceName.value = '';
        newWorkspacePrompt.value = '';
        
        // Disable the background scrolling
        document.body.style.overflow = 'hidden';
    }
    
    // Hide welcome modal
    function hideWelcomeModal() {
        console.log('Hiding welcome modal');
        welcomeModal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Load existing workspaces for the select dropdown
    async function loadExistingWorkspaces() {
        console.log('Fetching workspaces for dropdown');
        
        try {
            const response = await fetch(`${API_URL}/api/workspaces`);
            
            if (!response.ok) {
                throw new Error(`Failed to load workspaces: ${response.status}`);
            }
            
            const workspaces = await response.json();
            console.log(`Received ${workspaces.length} workspaces:`, workspaces);
            
            // Clear and populate workspace selector
            existingWorkspaceSelect.innerHTML = '';
            
            if (workspaces && workspaces.length > 0) {
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '-- Select Project --';
                existingWorkspaceSelect.appendChild(defaultOption);
                
                // Add workspace options
                workspaces.forEach(workspace => {
                    const option = document.createElement('option');
                    option.value = workspace;
                    option.textContent = workspace;
                    existingWorkspaceSelect.appendChild(option);
                });
                
                // Enable open button
                openWorkspaceBtn.disabled = true;
                console.log('Workspaces loaded in dropdown');
            } else {
                // No workspaces found
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No projects found';
                existingWorkspaceSelect.appendChild(option);
                
                // Disable open button
                openWorkspaceBtn.disabled = true;
                console.log('No workspaces found');
            }
        } catch (error) {
            console.error('Error loading workspaces:', error);
            
            // Show error in dropdown
            existingWorkspaceSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading projects';
            existingWorkspaceSelect.appendChild(option);
            
            // Disable open button
            openWorkspaceBtn.disabled = true;
        }
    }
    
    // Handle selection of existing workspace
    function handleExistingWorkspaceSelection() {
        const selected = existingWorkspaceSelect.value;
        console.log(`Workspace selected in dropdown: ${selected}`);
        openWorkspaceBtn.disabled = !selected;
    }
    
    // Handle creating a new workspace
    async function handleCreateWorkspace() {
        const workspaceName = newWorkspaceName.value.trim();
        const prompt = newWorkspacePrompt.value.trim();
        
        if (!workspaceName) {
            alert('Please enter a project name');
            return;
        }
        
        if (!prompt) {
            alert('Please enter a project description');
            return;
        }
        
        console.log(`Creating workspace: ${workspaceName}`);
        
        try {
            // Hide modal
            hideWelcomeModal();
            
            // Show loading overlay
            const loadingOverlay = document.getElementById('loading-overlay');
            loadingOverlay.classList.remove('hidden');
            
            // Generate HTML/CSS project
            console.log('Sending request to generate project');
            const response = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    workspace_name: workspaceName,
                    prompt: prompt
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate project');
            }
            
            const data = await response.json();
            console.log('Project generated successfully:', data);
            
            // Hide loading overlay
            loadingOverlay.classList.add('hidden');
            
            // Update the workspace selector in the app
            if (window.appModule) {
                await window.appModule.loadWorkspaces();
                
                // Set the current workspace
                const workspaceSelector = document.getElementById('workspace-selector');
                workspaceSelector.value = data.workspace_name;
                
                // Trigger change event
                const event = new Event('change');
                workspaceSelector.dispatchEvent(event);
                
                // Explicitly call workspace change handler
                if (window.appModule.handleWorkspaceChange) {
                    window.appModule.handleWorkspaceChange();
                }
                
                console.log(`Workspace set to: ${data.workspace_name}`);
            }
            
        } catch (error) {
            console.error('Error creating workspace:', error);
            alert(`Error: ${error.message}`);
            
            // Hide loading overlay
            document.getElementById('loading-overlay').classList.add('hidden');
            
            // Show modal again
            showWelcomeModal();
        }
    }
    
    // Handle opening an existing workspace
    function handleOpenWorkspace() {
        const selectedWorkspace = existingWorkspaceSelect.value;
        
        if (!selectedWorkspace) {
            alert('Please select a project');
            return;
        }
        
        console.log(`Opening workspace: ${selectedWorkspace}`);
        
        // Hide modal
        hideWelcomeModal();
        
        // Update the workspace selector in the app
        const workspaceSelector = document.getElementById('workspace-selector');
        workspaceSelector.value = selectedWorkspace;
        
        // Trigger change event
        const event = new Event('change');
        workspaceSelector.dispatchEvent(event);
        
        // Explicitly call workspace change handler
        if (window.appModule && window.appModule.handleWorkspaceChange) {
            window.appModule.handleWorkspaceChange();
        }
    }
}); 