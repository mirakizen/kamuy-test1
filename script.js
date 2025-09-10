document.addEventListener('DOMContentLoaded', () => {
    // --- Global Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const toolSections = document.querySelectorAll('.tool-section');

    // --- State Management ---
    const state = {
        activeTool: 'prompt-edit',
        'prompt-edit': {
            file: null,
            prompt: '',
            dimensions: { width: 0, height: 0 },
            view: 'upload' // 'upload', 'edit', 'result'
        },
        'removal-tool': {
            file: null,
            prompt: '',
            dimensions: { width: 0, height: 0 },
            view: 'upload', // 'upload', 'edit', 'result'
            mode: 'background', // 'background', 'object'
            objectToRemove: ''
        },
        // ... (add states for other tools later)
    };

    // --- Dark Mode Logic ---
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');
    
    // --- Navigation Logic ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            state.activeTool = link.dataset.tool;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            toolSections.forEach(section => section.classList.remove('active'));
            document.getElementById(state.activeTool).classList.add('active');
            render();
        });
    });

    // --- Generic API Call ---
    const generateImage = async (toolState) => {
        const generateButton = document.querySelector(`#${state.activeTool} #generate-button`);
        const generateButtonText = document.querySelector(`#${state.activeTool} #generate-button-text`);
        const generateLoader = document.querySelector(`#${state.activeTool} #generate-loader`);

        generateButton.disabled = true;
        generateLoader.classList.remove('hidden');
        generateButtonText.textContent = 'Generating...';

        try {
            const compressedFile = await compressImage(toolState.file);
            const base64Image = await fileToBase64(compressedFile);
            const response = await fetch('/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type, prompt: toolState.prompt, width: toolState.dimensions.width, height: toolState.dimensions.height }),
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'The server returned an error.'); }
            const data = await response.json();
            if (data.edited_image_url) {
                toolState.resultUrl = data.edited_image_url;
                toolState.view = 'result';
                render();
            } else { throw new Error('Could not find the edited image in the response.'); }
        } catch (error) { console.error('Generation failed:', error); alert(`Error: ${error.message}`);
        } finally {
            generateButton.disabled = false;
            generateLoader.classList.add('hidden');
            generateButtonText.textContent = 'Generate';
        }
    };

    // --- Dynamic UI Rendering ---
    const render = () => {
        const toolState = state[state.activeTool];
        const container = document.querySelector(`#${state.activeTool} .main-container`);
        if (!container) return;

        let content = '';

        if (toolState.view === 'upload') {
            content = `
                <section>
                    <input type="file" id="${state.activeTool}-image-input" class="hidden" accept="image/*" />
                    <div id="${state.activeTool}-dropzone" class="dropzone rounded-lg p-10 text-center cursor-pointer">
                        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg>
                        <p class="mt-4 text-lg font-medium">Click to upload or drag & drop</p>
                        <p class="text-sm text-secondary mt-1">PNG, JPG, or WEBP. Max 8MB.</p>
                    </div>
                </section>
            `;
        } else if (toolState.view === 'edit') {
            const objectInputHTML = state.activeTool === 'removal-tool' ? `
                <div class="my-4 space-y-2">
                    <div class="flex items-center space-x-4">
                        <label class="flex items-center"><input type="radio" name="removal-mode" value="background" ${toolState.mode === 'background' ? 'checked' : ''} class="mr-2">Remove Background</label>
                        <label class="flex items-center"><input type="radio" name="removal-mode" value="object" ${toolState.mode === 'object' ? 'checked' : ''} class="mr-2">Remove Object</label>
                    </div>
                    <div id="object-input-container" class="${toolState.mode === 'object' ? '' : 'hidden'}">
                        <label for="object-input" class="block text-sm font-bold mb-2">Object to remove:</label>
                        <input type="text" id="object-input" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., the red car" value="${toolState.objectToRemove || ''}">
                    </div>
                </div>
            ` : `
                <div>
                    <label for="prompt-input" class="block text-sm font-bold mb-2">Describe your edit:</label>
                    <textarea id="prompt-input" rows="3" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., Change the corgi into a felt wool figure">${toolState.prompt || ''}</textarea>
                </div>
            `;

            content = `
                <section>
                    <div class="mb-4"><img id="image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>
                    ${objectInputHTML}
                    <div class="mt-4 flex space-x-2">
                        <button id="generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span id="generate-button-text">Generate</span><div id="generate-loader" class="loader w-5 h-5 rounded-full border-2 hidden ml-2"></div></button>
                        <button id="reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button>
                    </div>
                </section>
            `;
        } else if (toolState.view === 'result') {
            content = `
                <section class="space-y-4">
                    <div>
                        <h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3>
                        <p id="result-prompt" class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.prompt}"</p>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-secondary mb-2">Original</label>
                        <img src="${URL.createObjectURL(toolState.file)}" class="rounded-lg border border-primary w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-secondary mb-2">Edited</label>
                        <img src="${toolState.resultUrl}" class="rounded-lg border border-primary w-full">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button id="download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button>
                        <button id="new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button>
                    </div>
                </section>
            `;
        }
        
        container.innerHTML = content;
        addEventListeners(); // Re-add listeners to the new content
    };

    // --- Event Listener Setup ---
    function addEventListeners() {
        const toolState = state[state.activeTool];
        
        // Upload listeners
        const dropzone = document.getElementById(`${state.activeTool}-dropzone`);
        const imageInput = document.getElementById(`${state.activeTool}-image-input`);
        if (dropzone) {
            dropzone.addEventListener('click', () => imageInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
            imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
        }
        
        // Edit listeners
        const generateButton = document.getElementById('generate-button');
        if(generateButton) {
            generateButton.addEventListener('click', () => {
                if (state.activeTool === 'prompt-edit') {
                    toolState.prompt = document.getElementById('prompt-input').value;
                } else if (state.activeTool === 'removal-tool') {
                    if (toolState.mode === 'background') {
                        toolState.prompt = 'remove the background';
                    } else {
                        toolState.objectToRemove = document.getElementById('object-input').value;
                        toolState.prompt = `remove the ${toolState.objectToRemove}`;
                    }
                }
                generateImage(toolState);
            });
        }

        const resetButton = document.getElementById('reset-button');
        if(resetButton) resetButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; render(); });

        const removalModeRadios = document.querySelectorAll('input[name="removal-mode"]');
        if (removalModeRadios) {
            removalModeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    toolState.mode = e.target.value;
                    document.getElementById('object-input-container').classList.toggle('hidden', e.target.value !== 'object');
                });
            });
        }
        
        // Result listeners
        const newEditButton = document.getElementById('new-edit-button');
        if(newEditButton) newEditButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; render(); });
        
        const downloadButton = document.getElementById('download-button');
        if (downloadButton) {
            downloadButton.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(toolState.resultUrl);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'kamuy-edit.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (error) { console.error("Download failed:", error); alert("Could not download the image."); }
            });
        }
    }

    const handleFileSelect = (file) => {
        const toolState = state[state.activeTool];
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
        toolState.file = file;
        
        const img = new Image();
        img.onload = () => {
            toolState.dimensions = { width: img.naturalWidth, height: img.naturalHeight };
            toolState.view = 'edit';
            render();
        };
        img.src = URL.createObjectURL(file);
    };

    // --- Helper Functions ---
    const fileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const compressImage = (file) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas'); let { width, height } = img; const maxDim = 1920;
            if (width > maxDim || height > maxDim) { if (width > height) { height = (height / width) * maxDim; width = maxDim; } else { width = (width / height) * maxDim; height = maxDim; } }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => { URL.revokeObjectURL(img.src); resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); }, 'image/jpeg', 0.9);
        };
        img.onerror = reject;
    });

    // --- Initial Render ---
    render();
});
