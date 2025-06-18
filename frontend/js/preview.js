// Preview functionality
const previewFrame = document.getElementById('preview-frame');
const refreshBtn = document.getElementById('refresh-preview');
const API_URL = 'http://localhost:8000';
let currentWorkspace = '';
let currentFile = '';

// Initialize the preview functionality
function initPreview() {
    console.log('Initializing preview...');
    
    if (!previewFrame) {
        console.error('Preview frame not found');
        return;
    }
    
    if (!refreshBtn) {
        console.error('Refresh button not found');
        return;
    }
    
    // Set default preview content
    previewFrame.srcdoc = '<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>No project selected</h3><p>Select a project to see the preview.</p></div>';
    
    // Add refresh button event listener
    refreshBtn.addEventListener('click', () => {
        console.log('Manual refresh requested');
        refreshPreview();
    });
    
    console.log('Preview initialized');
}

// Refresh the preview with the current workspace content
async function refreshPreview() {
    console.log(`Refreshing preview for workspace: ${currentWorkspace}, file: ${currentFile}`);
    
    if (!previewFrame) {
        console.error('Preview frame not found');
        return;
    }
    
    if (!currentWorkspace) {
        console.warn('No workspace selected for preview');
        previewFrame.srcdoc = '<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>No project selected</h3><p>Select a project to see the preview.</p></div>';
        return;
    }
    
    try {
        // First attempt to use live content from the editor if an HTML file is being edited
        if (currentFile && currentFile.endsWith('.html') && window.editorModule) {
            console.log('Using live content from editor for preview');
            let htmlContent = window.editorModule.getEditorContent();
            
            if (htmlContent) {
                // Check if we need to add CSS content
                if (window.fileExplorerModule) {
                    try {
                        const cssFile = 'styles.css';
                        console.log(`Trying to fetch CSS: ${cssFile}`);
                        
                        const cssResponse = await fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/${cssFile}`);
                        
                        if (cssResponse.ok) {
                            const cssData = await cssResponse.json();
                            const cssContent = cssData.content;
                            
                            // Inject the CSS into the HTML
                            console.log('Injecting CSS into HTML content');
                            htmlContent = htmlContent.replace('</head>', `<style>${cssContent}</style></head>`);
                        } else {
                            console.warn(`CSS file not found: ${cssFile}`);
                        }
                    } catch (cssError) {
                        console.warn('Could not load CSS file:', cssError);
                    }
                }
                
                // Update preview
                console.log('Updating preview with live content, length:', htmlContent.length);
                previewFrame.srcdoc = htmlContent;
                return;
            }
        }
        
        // Check if preview.html exists in the workspace (combined HTML + CSS)
        console.log('Trying to load preview.html');
        const response = await fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/preview.html`);
        
        if (response.ok) {
            // If preview.html exists, use it
            console.log('preview.html found, using it for preview');
            const previewData = await response.json();
            previewFrame.srcdoc = previewData.content;
        } else {
            // If not, try to load index.html and styles.css separately
            console.log('preview.html not found, trying index.html + styles.css');
            
            try {
                const htmlResponse = await fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/index.html`);
                
                if (htmlResponse.ok) {
                    console.log('index.html found');
                    const htmlData = await htmlResponse.json();
                    let htmlContent = htmlData.content;
                    
                    // Try to get the CSS file
                    try {
                        console.log('Trying to load styles.css');
                        const cssResponse = await fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/styles.css`);
                        
                        if (cssResponse.ok) {
                            console.log('styles.css found, injecting into HTML');
                            const cssData = await cssResponse.json();
                            const cssContent = cssData.content;
                            
                            // Inject the CSS into the HTML
                            htmlContent = htmlContent.replace('</head>', `<style>${cssContent}</style></head>`);
                        } else {
                            console.warn('styles.css not found');
                        }
                    } catch (cssError) {
                        console.warn('Could not load CSS file:', cssError);
                    }
                    
                    // Update the preview with HTML and potentially CSS
                    console.log('Updating preview with combined HTML/CSS, length:', htmlContent.length);
                    previewFrame.srcdoc = htmlContent;
                } else {
                    // If we can't load the HTML, see if we should show the current file
                    console.log('index.html not found, checking current file');
                    
                    if (currentFile && (currentFile.endsWith('.html') || currentFile.endsWith('.css'))) {
                        console.log(`Loading current file for preview: ${currentFile}`);
                        const fileResponse = await fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/${currentFile}`);
                        
                        if (fileResponse.ok) {
                            const fileData = await fileResponse.json();
                            
                            // For HTML files, show directly
                            if (currentFile.endsWith('.html')) {
                                console.log('Showing HTML file directly');
                                previewFrame.srcdoc = fileData.content;
                            } else {
                                // For CSS files, show a preview with sample elements
                                console.log('Showing CSS preview');
                                previewFrame.srcdoc = `
                                <html>
                                <head>
                                    <title>CSS Preview</title>
                                    <style>${fileData.content}</style>
                                </head>
                                <body>
                                    <div style="padding: 20px; font-family: Arial, sans-serif;">
                                        <h3>CSS Preview</h3>
                                        <p>This is a preview of the CSS file. Open an HTML file to see the full preview.</p>
                                        <div class="sample-elements">
                                            <h1>Sample Heading 1</h1>
                                            <h2>Sample Heading 2</h2>
                                            <p>Sample paragraph text</p>
                                            <button>Sample Button</button>
                                            <div class="box">Sample Box</div>
                                        </div>
                                    </div>
                                </body>
                                </html>`;
                            }
                        } else {
                            console.warn(`Could not load file: ${currentFile}`);
                            previewFrame.srcdoc = '<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>Preview not available</h3><p>Could not load the selected file.</p></div>';
                        }
                    } else {
                        console.warn('No HTML file found for preview');
                        previewFrame.srcdoc = '<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>No HTML file found</h3><p>Create or select an HTML file to see a preview.</p></div>';
                    }
                }
            } catch (htmlError) {
                console.error('Error loading HTML:', htmlError);
                previewFrame.srcdoc = '<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>Error loading preview</h3><p>Could not load HTML file.</p></div>';
            }
        }
    } catch (error) {
        console.error('Error refreshing preview:', error);
        previewFrame.srcdoc = `<div style="padding: 20px; font-family: Arial, sans-serif;"><h3>Error refreshing preview</h3><p>${error.message}</p></div>`;
    }
}

// Update the current workspace
function setWorkspace(workspace) {
    console.log(`Setting preview workspace: ${workspace}`);
    currentWorkspace = workspace;
    refreshPreview();
}

// Update the current file
function setCurrentFile(file) {
    console.log(`Setting preview current file: ${file}`);
    currentFile = file;
    refreshPreview();
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initPreview);

// Export functions for use by other modules
window.previewModule = {
    refreshPreview,
    setWorkspace,
    setCurrentFile
}; 