// Minimal robust frontend for CodeGen HTML/CSS workspaces
const API_URL = 'http://localhost:8000';
const workspaceSelector = document.getElementById('workspace-selector');
const refreshBtn = document.getElementById('refresh-workspaces');
const fileList = document.getElementById('file-list');
const currentFileSpan = document.getElementById('current-file');
const saveBtn = document.getElementById('save-btn');
const previewFrame = document.getElementById('preview-frame');
let editor;
let currentWorkspace = '';
let currentFile = '';
let workspaceDescriptions = {};
let currentWorkspaceDescription = '';
window._otherFileContent = '';

// --- Workspace Loading ---
async function loadWorkspaces() {
    workspaceSelector.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Select Workspace --';
    workspaceSelector.appendChild(opt);
    try {
        const res = await fetch(`${API_URL}/api/workspaces`);
        const workspaces = await res.json();
        for (const ws of workspaces) {
            const o = document.createElement('option');
            o.value = ws;
            o.textContent = ws;
            workspaceSelector.appendChild(o);
            // Try to fetch description from README.md
            try {
                const readmeRes = await fetch(`${API_URL}/api/workspace/${ws}/file/README.md`);
                if (readmeRes.ok) {
                    const readmeData = await readmeRes.json();
                    // Try to extract description from README
                    const match = readmeData.content.match(/Description:(.*)/i);
                    workspaceDescriptions[ws] = match ? match[1].trim() : '';
                }
            } catch {}
        }
    } catch (e) {
        alert('Failed to load workspaces');
    }
}

workspaceSelector.addEventListener('change', () => {
    currentWorkspace = workspaceSelector.value;
    if (currentWorkspace) {
        loadFiles(currentWorkspace);
    } else {
        fileList.innerHTML = '';
        currentFileSpan.textContent = 'No file selected';
        if (editor) editor.setValue('');
        previewFrame.srcdoc = '';
    }
});
refreshBtn.addEventListener('click', loadWorkspaces);

// --- File List Loading ---
async function loadFiles(workspace) {
    fileList.innerHTML = '<li>Loading...</li>';
    currentWorkspaceDescription = workspaceDescriptions[workspace] || '';
    try {
        const res = await fetch(`${API_URL}/api/workspace/${workspace}/files`);
        const files = await res.json();
        fileList.innerHTML = '';
        if (!files.length) {
            fileList.innerHTML = '<li>No files found</li>';
            return;
        }
        files.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            li.dataset.file = f;
            li.onclick = () => selectFile(f);
            fileList.appendChild(li);
        });
        // Auto-select index.html or first file
        if (files.includes('index.html')) selectFile('index.html');
        else selectFile(files[0]);
    } catch (e) {
        fileList.innerHTML = '<li>Error loading files</li>';
    }
}

// --- File Selection and Editor ---
function selectFile(file) {
    currentFile = file;
    Array.from(fileList.children).forEach(li => li.classList.toggle('active', li.dataset.file === file));
    currentFileSpan.textContent = file;
    loadFileContent(currentWorkspace, file);
    filePromptInput.disabled = false;
    updateFileBtn.disabled = !filePromptInput.value.trim();
}

async function loadFileContent(workspace, file) {
    if (!editor) return;
    editor.setValue('Loading...');
    try {
        const res = await fetch(`${API_URL}/api/workspace/${workspace}/file/${file}`);
        const data = await res.json();
        editor.setValue(data.content || '');
        setEditorMode(file);
        saveBtn.disabled = false;
        updatePreview();
    } catch (e) {
        editor.setValue('Error loading file');
        saveBtn.disabled = true;
    }
}

function setEditorMode(file) {
    if (file.endsWith('.html')) editor.setOption('mode', 'htmlmixed');
    else if (file.endsWith('.css')) editor.setOption('mode', 'css');
    else if (file.endsWith('.js')) editor.setOption('mode', 'javascript');
    else editor.setOption('mode', 'text/plain');
}

// --- Save File ---
saveBtn.onclick = async function() {
    if (!currentWorkspace || !currentFile) return;
    saveBtn.disabled = true;
    try {
        await fetch(`${API_URL}/api/update-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_name: currentWorkspace,
                file_name: currentFile,
                content: editor.getValue()
            })
        });
        updatePreview();
    } catch (e) {
        alert('Failed to save file');
    }
    saveBtn.disabled = false;
};

// --- Editor and Preview ---
function updatePreview() {
    if (!currentWorkspace) return;
    if (currentFile.endsWith('.html')) {
        // Use the latest styles.css content if available
        let cssContent = window._otherFileContent || '';
        fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/styles.css`).then(r => r.ok ? r.json() : {content:''}).then(cssData => {
            let html = editor.getValue();
            if (cssContent) {
                html = html.replace('</head>', `<style>${cssContent}</style></head>`);
            } else if (cssData.content) {
                html = html.replace('</head>', `<style>${cssData.content}</style></head>`);
            }
            previewFrame.srcdoc = html;
            window._otherFileContent = '';
        });
    } else if (currentFile.endsWith('.css')) {
        // Use the latest index.html content if available
        let htmlContent = window._otherFileContent || '';
        if (htmlContent) {
            previewFrame.srcdoc = htmlContent.replace('</head>', `<style>${editor.getValue()}</style></head>`);
            window._otherFileContent = '';
        } else {
            fetch(`${API_URL}/api/workspace/${currentWorkspace}/file/index.html`).then(r => r.ok ? r.json() : {content:''}).then(htmlData => {
                let html = htmlData.content || '';
                html = html.replace('</head>', `<style>${editor.getValue()}</style></head>`);
                previewFrame.srcdoc = html;
            });
        }
    } else {
        previewFrame.srcdoc = '';
        window._otherFileContent = '';
    }
}

// --- Initialize CodeMirror ---
window.onload = function() {
    editor = CodeMirror(document.getElementById('editor'), {
        value: '',
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
    editor.on('change', () => {
        if (currentFile.endsWith('.html') || currentFile.endsWith('.css')) updatePreview();
    });
    loadWorkspaces();
};

// --- New Workspace Modal ---
const newWorkspaceBtn = document.getElementById('new-workspace-btn');
const newWorkspaceModal = document.getElementById('new-workspace-modal');
const createNewWorkspaceBtn = document.getElementById('create-new-workspace');
const cancelNewWorkspaceBtn = document.getElementById('cancel-new-workspace');
const newWorkspaceNameInput = document.getElementById('new-workspace-name');
const newWorkspacePromptInput = document.getElementById('new-workspace-prompt');

newWorkspaceBtn.onclick = () => {
    newWorkspaceModal.style.display = 'flex';
    newWorkspaceNameInput.value = '';
    newWorkspacePromptInput.value = '';
    newWorkspaceNameInput.focus();
};
cancelNewWorkspaceBtn.onclick = () => {
    newWorkspaceModal.style.display = 'none';
};
createNewWorkspaceBtn.onclick = async () => {
    const name = newWorkspaceNameInput.value.trim();
    const prompt = newWorkspacePromptInput.value.trim();
    if (!name || !prompt) {
        alert('Please enter both a workspace name and a prompt.');
        return;
    }
    createNewWorkspaceBtn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_name: name, prompt })
        });
        if (!res.ok) throw new Error('Failed to create workspace');
        newWorkspaceModal.style.display = 'none';
        workspaceDescriptions[name] = prompt;
        await loadWorkspaces();
        workspaceSelector.value = name;
        workspaceSelector.dispatchEvent(new Event('change'));
    } catch (e) {
        alert('Failed to create workspace');
    }
    createNewWorkspaceBtn.disabled = false;
};

// --- Prompt for File Modification ---
const filePromptInput = document.getElementById('file-prompt');
const updateFileBtn = document.getElementById('update-file-btn');
filePromptInput.oninput = function() {
    updateFileBtn.disabled = !filePromptInput.value.trim() || !currentFile;
};

updateFileBtn.onclick = async function() {
    if (!currentWorkspace || !currentFile) return;
    const prompt = filePromptInput.value.trim();
    if (!prompt) return;
    updateFileBtn.disabled = true;
    filePromptInput.disabled = true;
    try {
        // Get previous code and workspace description
        const previous_code = editor.getValue();
        let workspace_description = currentWorkspaceDescription;
        if (!workspace_description && workspaceDescriptions[currentWorkspace]) {
            workspace_description = workspaceDescriptions[currentWorkspace];
        }
        if (!workspace_description) workspace_description = '';
        const res = await fetch(`${API_URL}/api/update-from-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workspace_name: currentWorkspace,
                file_name: currentFile,
                prompt,
                previous_code,
                workspace_description
            })
        });
        if (!res.ok) throw new Error('Failed to update file');
        const data = await res.json();

        // If backend returns both files' content:
        if (data.files && Array.isArray(data.files)) {
            data.files.forEach(f => {
                if (f.file_name === currentFile) {
                    editor.setValue(f.content || '');
                }
                // If the other file (index.html or styles.css) is returned, update preview accordingly
                if ((currentFile.endsWith('.html') && f.file_name === 'styles.css') ||
                    (currentFile.endsWith('.css') && f.file_name === 'index.html')) {
                    window._otherFileContent = f.content;
                }
            });
        } else if (data.content) {
            editor.setValue(data.content || '');
        }
        updatePreview();
        filePromptInput.value = '';
    } catch (e) {
        alert('Failed to update file');
    }
    updateFileBtn.disabled = false;
    filePromptInput.disabled = false;
}; 