// Editor functionality
const editorContainer = document.getElementById('editor');
const currentFileElement = document.getElementById('current-file');
const saveBtn = document.getElementById('save-btn');
const API_URL = 'http://localhost:8000';

let editor;
let currentWorkspace = '';
let currentFileName = '';
let isEditorEnabled = false;

// Initialize CodeMirror editor
function initEditor() {
    console.log('Initializing CodeMirror editor...');
    
    if (!editorContainer) {
        console.error('Editor container not found');
        return;
    }
    
    try {
        // Check if CodeMirror is loaded
        if (typeof CodeMirror === 'undefined') {
            console.error('CodeMirror library not loaded');
            return;
        }
        
        // Create CodeMirror instance
        editor = CodeMirror(editorContainer, {
            lineNumbers: true,
            mode: 'htmlmixed',
            theme: 'default',
            indentUnit: 2,
            smartIndent: true,
            lineWrapping: true,
            autoCloseTags: true,
            autoCloseBrackets: true,
            matchTags: true,
            matchBrackets: true
        });
        
        console.log('CodeMirror editor created successfully');
        
        // Disable editor initially
        editor.setOption('readOnly', true);
        
        // Add event listeners
        saveBtn.addEventListener('click', saveFile);
        
        // Add editor change event to update preview in real-time for HTML/CSS files
        editor.on('change', debounce(() => {
            if (isEditorEnabled && (currentFileName.endsWith('.html') || currentFileName.endsWith('.css'))) {
                console.log('Editor content changed, refreshing preview');
                if (window.previewModule) {
                    window.previewModule.refreshPreview();
                }
            }
        }, 1000));
        
        console.log('Editor event listeners added');
    } catch (error) {
        console.error('Error initializing editor:', error);
    }
}

// Debounce function to prevent too many preview updates
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Enable editor
function enableEditor() {
    console.log('Enabling editor');
    isEditorEnabled = true;
    editor.setOption('readOnly', false);
    saveBtn.disabled = false;
}

// Disable editor
function disableEditor() {
    console.log('Disabling editor');
    isEditorEnabled = false;
    editor.setOption('readOnly', true);
    saveBtn.disabled = true;
}

// Load file into editor
async function loadFile(workspace, fileName) {
    console.log(`Loading file ${fileName} from workspace ${workspace}`);
    
    if (!editor) {
        console.error('Editor not initialized');
        return false;
    }
    
    if (!workspace || !fileName) {
        console.error('Invalid workspace or fileName');
        return false;
    }
    
    try {
        currentWorkspace = workspace;
        currentFileName = fileName;
        
        console.log(`Fetching file content from: ${API_URL}/api/workspace/${workspace}/file/${fileName}`);
        const response = await fetch(`${API_URL}/api/workspace/${workspace}/file/${fileName}`);
        
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`File content received, length: ${data.content.length} characters`);
        
        // Set editor content
        editor.setValue(data.content);
        if (!data.content) {
            console.warn('Loaded file content is empty');
        } else {
            console.log('Editor content set successfully');
        }
        
        // Set editor mode based on file extension
        setEditorMode(fileName);
        
        // Update UI
        currentFileElement.textContent = fileName;
        enableEditor();
        
        // Update file preview if applicable
        if (window.previewModule) {
            window.previewModule.setCurrentFile(fileName);
        }
        
        console.log('File loaded successfully');
        return true;
    } catch (error) {
        console.error('Error loading file:', error);
        disableEditor();
        currentFileElement.textContent = `Error loading file: ${error.message}`;
        return false;
    }
}

// Set editor mode based on file extension
function setEditorMode(fileName) {
    console.log(`Setting editor mode for file: ${fileName}`);
    let mode = 'text/plain';
    
    if (fileName.endsWith('.html')) {
        mode = 'htmlmixed';
    } else if (fileName.endsWith('.css')) {
        mode = 'css';
    } else if (fileName.endsWith('.js')) {
        mode = 'javascript';
    } else if (fileName.endsWith('.json')) {
        mode = 'javascript';
    }
    
    console.log(`Setting editor mode to: ${mode}`);
    editor.setOption('mode', mode);
}

// Save file
async function saveFile() {
    console.log('Saving file...');
    
    if (!currentWorkspace || !currentFileName) {
        console.error('No file selected');
        alert('No file selected');
        return;
    }
    
    try {
        const content = editor.getValue();
        console.log(`Saving file ${currentFileName} to workspace ${currentWorkspace}, content length: ${content.length} characters`);
        
        const response = await fetch(`${API_URL}/api/update-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspace_name: currentWorkspace,
                file_name: currentFileName,
                content: content
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
        }
        
        console.log('File saved successfully');
        
        // If this is an HTML or CSS file, update the preview
        if (currentFileName.endsWith('.html') || currentFileName.endsWith('.css')) {
            if (window.previewModule) {
                console.log('Refreshing preview after save');
                window.previewModule.refreshPreview();
            }
        }
        
        // Flash the save button to indicate success
        saveBtn.classList.add('success');
        setTimeout(() => {
            saveBtn.classList.remove('success');
        }, 1000);
        
    } catch (error) {
        console.error('Error saving file:', error);
        alert(`Error saving file: ${error.message}`);
    }
}

// Get editor content
function getEditorContent() {
    if (!editor) {
        console.error('Editor not initialized');
        return '';
    }
    return editor.getValue();
}

// Set editor content
function setEditorContent(content) {
    console.log(`Setting editor content, length: ${content ? content.length : 0} characters`);
    
    if (!editor) {
        console.error('Editor not initialized');
        return;
    }
    
    editor.setValue(content || '');
}

// Get current file name
function getCurrentFileName() {
    return currentFileName;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initEditor);

// Export functions for use by other modules
window.editorModule = {
    loadFile,
    getEditorContent,
    setEditorContent,
    getCurrentFileName,
    enableEditor,
    disableEditor
}; 