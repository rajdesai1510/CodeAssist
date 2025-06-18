// File Explorer functionality
const fileList = document.getElementById('file-list');
const API_URL = 'http://localhost:8000';
let currentWorkspace = '';

// Initialize file explorer
function initFileExplorer() {
    console.log('Initializing file explorer...');
    
    // Event delegation for file clicks
    fileList.addEventListener('click', handleFileClick);
}

// Load files for a workspace
async function loadFilesForWorkspace(workspace) {
    console.log(`Loading files for workspace: ${workspace}`);
    
    if (!workspace || workspace === '-- Select Project --') {
        fileList.innerHTML = '<li class="error">No project selected</li>';
        console.warn('No valid workspace selected');
        return false;
    }
    
    try {
        currentWorkspace = workspace;
        
        // Reset file list with loading indicator
        fileList.innerHTML = '<li class="loading"><i class="fas fa-spinner fa-spin"></i> Loading files...</li>';
        
        // Fetch files for the workspace
        console.log(`Fetching files from API: ${API_URL}/api/workspace/${workspace}/files`);
        const response = await fetch(`${API_URL}/api/workspace/${workspace}/files`);
        
        if (!response.ok) {
            throw new Error(`Failed to load files: ${response.status} ${response.statusText}`);
        }
        
        const files = await response.json();
        console.log(`Received ${files.length} files:`, files);
        
        // Clear loading indicator
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<li class="info">No files found in this project</li>';
            console.warn('No files found in workspace');
            // Always show the file list
            fileList.style.display = 'block';
            return true;
        }
        
        // Sort files by type and name
        files.sort((a, b) => {
            // Put HTML files first, then CSS, then others
            const getFileTypeWeight = (file) => {
                if (file.endsWith('.html')) return 1;
                if (file.endsWith('.css')) return 2;
                return 3;
            };
            
            const weightA = getFileTypeWeight(a);
            const weightB = getFileTypeWeight(b);
            
            if (weightA !== weightB) {
                return weightA - weightB;
            }
            
            // Sort alphabetically within same type
            return a.localeCompare(b);
        });
        
        // Create file list items
        files.forEach(file => {
            const li = document.createElement('li');
            li.dataset.file = file;
            
            // Add appropriate icon based on file type
            let icon = 'fa-file';
            if (file.endsWith('.html')) {
                icon = 'fa-file-code';
            } else if (file.endsWith('.css')) {
                icon = 'fa-file-alt';
            } else if (file.endsWith('.js')) {
                icon = 'fa-file-code';
            } else if (file.endsWith('.json')) {
                icon = 'fa-file-code';
            } else if (file.endsWith('.md')) {
                icon = 'fa-file-alt';
            } else if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png') || file.endsWith('.gif')) {
                icon = 'fa-file-image';
            }
            
            li.innerHTML = `<i class="fas ${icon}"></i> ${file}`;
            fileList.appendChild(li);
        });
        
        // Always show the file list
        fileList.style.display = 'block';
        console.log('Files added to UI successfully:', files);
        
        // If index.html exists, select it by default
        const defaultFile = files.find(file => file === 'index.html');
        if (defaultFile) {
            console.log(`Selecting default file: ${defaultFile}`);
            selectFile(defaultFile);
        } else if (files.length > 0) {
            console.log(`No index.html found, selecting first file: ${files[0]}`);
            selectFile(files[0]);
        }
        
        return true;
    } catch (error) {
        console.error('Error loading files:', error);
        fileList.innerHTML = `<li class="error">Error loading files: ${error.message}</li>`;
        return false;
    }
}

// Handle file click
function handleFileClick(event) {
    const li = event.target.closest('li');
    if (!li) return;
    
    // Skip if it's the error message or info message
    if (li.classList.contains('error') || li.classList.contains('loading') || li.classList.contains('info')) return;
    
    const fileName = li.dataset.file;
    if (fileName) {
        console.log(`File clicked: ${fileName}`);
        selectFile(fileName);
    }
}

// Select a file
async function selectFile(fileName) {
    console.log(`Selecting file: ${fileName} in workspace: ${currentWorkspace}`);
    
    if (!fileName || !currentWorkspace) {
        console.warn('Cannot select file: invalid file name or workspace');
        return;
    }
    
    // Remove active class from all file items
    const fileItems = fileList.querySelectorAll('li');
    fileItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to selected file
    const selectedItem = Array.from(fileItems).find(item => item.dataset.file === fileName);
    if (selectedItem) {
        selectedItem.classList.add('active');
    } else {
        console.warn(`Could not find element for file: ${fileName}`);
    }
    
    // Update the app's current file
    if (window.appModule && window.appModule.setCurrentFile) {
        window.appModule.setCurrentFile(fileName);
    }
    
    // Load file content in editor
    if (window.editorModule) {
        try {
            console.log(`Loading file content for: ${fileName}`);
            const success = await window.editorModule.loadFile(currentWorkspace, fileName);
            
            if (success) {
                console.log(`File content loaded successfully: ${fileName}`);
                
                // Update preview if applicable
                if (window.previewModule) {
                    window.previewModule.setCurrentFile(fileName);
                    window.previewModule.refreshPreview();
                }
            } else {
                console.error(`Failed to load file content: ${fileName}`);
            }
        } catch (error) {
            console.error(`Error loading file: ${error.message}`);
        }
    } else {
        console.error('Editor module not available');
    }
}

// Get current workspace
function getCurrentWorkspace() {
    return currentWorkspace;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initFileExplorer);

// Export functions
window.fileExplorerModule = {
    loadFilesForWorkspace,
    selectFile,
    getCurrentWorkspace
}; 