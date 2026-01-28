const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesGrid = document.getElementById('filesGrid');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const refreshBtn = document.getElementById('refreshBtn');
const progressBar = document.getElementById('progressBar');
const progressContainer = document.getElementById('progressContainer');
const toast = document.getElementById('toast');

let API_KEY = localStorage.getItem('nex_api_key') || '';
if (API_KEY) {
    apiKeyInput.value = API_KEY;
    loadFiles();
}

// Save API Key
saveKeyBtn.addEventListener('click', () => {
    API_KEY = apiKeyInput.value.trim();
    localStorage.setItem('nex_api_key', API_KEY);
    showToast('API Key saved and connected!');
    loadFiles();
});

// Drag and Drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        uploadFile(fileInput.files[0]);
    }
});

refreshBtn.addEventListener('click', loadFiles);

async function uploadFile(file) {
    if (!API_KEY) {
        showToast('Please enter your API Key first!', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('x-api-key', API_KEY);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                progressBar.style.width = percent + '%';
            }
        };

        xhr.onload = function () {
            if (xhr.status === 200) {
                showToast('File uploaded successfully!');
                loadFiles();
            } else {
                const res = JSON.parse(xhr.responseText);
                showToast(res.error || 'Upload failed', 'error');
            }
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 1000);
        };

        xhr.onerror = function () {
            showToast('Network error during upload', 'error');
            progressContainer.style.display = 'none';
        };

        xhr.send(formData);
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload error', 'error');
        progressContainer.style.display = 'none';
    }
}

async function loadFiles() {
    if (!API_KEY) return;

    filesGrid.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-circle-notch fa-spin"></i>
            <p>Fetching files...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/files', {
            headers: { 'x-api-key': API_KEY }
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const files = await response.json();
        renderFiles(files);
    } catch (error) {
        console.error('Fetch error:', error);
        filesGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load files. Check your API Key.</p>
            </div>
        `;
    }
}

function renderFiles(files) {
    if (files.length === 0) {
        filesGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-folder-open"></i>
                <p>No files uploaded yet.</p>
            </div>
        `;
        return;
    }

    filesGrid.innerHTML = files.map(file => `
        <div class="file-card">
            <div class="file-icon">
                <i class="${getFileIcon(file.name)}"></i>
            </div>
            <div class="file-info">
                <h4>${file.name}</h4>
                <span>${formatSize(file.size)} • ${new Date(file.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="file-actions">
                <button class="icon-btn" onclick="copyUrl('${file.url}')" title="Copy URL">
                    <i class="fas fa-link"></i>
                </button>
                <a href="${file.url}" target="_blank" class="icon-btn" title="Open">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    `).join('');
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'png': 'fas fa-image',
        'jpg': 'fas fa-image',
        'jpeg': 'fas fa-image',
        'gif': 'fas fa-image',
        'pdf': 'fas fa-file-pdf',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        'mp4': 'fas fa-video',
        'mp3': 'fas fa-music',
        'js': 'fab fa-js',
        'html': 'fab fa-html5',
        'css': 'fab fa-css3'
    };
    return icons[ext] || 'fas fa-file';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function copyUrl(url) {
    const fullUrl = window.location.origin + url;
    navigator.clipboard.writeText(fullUrl);
    showToast('URL copied to clipboard!');
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
