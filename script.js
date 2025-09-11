document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentContainer = document.getElementById('content-container');

    const state = {
        activeTool: 'prompt-edit',
        'prompt-edit': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload' },
        'removal-tool': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', mode: 'background', objectToRemove: '' },
        'artify': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', selectedStyle: null }
    };

    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            state.activeTool = link.dataset.tool;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            render();
        });
    });

    const createEngineeredPrompt = (tool, toolState) => {
        const preservationPrompt = " Based on the reference image, it is crucial to preserve the identity, facial features, expressions, skin tones, and poses of all subjects. All other elements and the overall style of the image must remain unchanged.";
        if (tool === 'prompt-edit') { return toolState.userInput + preservationPrompt; }
        if (tool === 'removal-tool') {
            if (toolState.mode === 'background') return 'remove the background, keeping the subject perfectly intact. Output with a transparent background. Do not add a watermark.';
            if (toolState.mode === 'object') return `[Deletion] Remove the ${toolState.objectToRemove}, inpainting the area to match the background naturally, keeping all other elements unchanged.`;
            if (toolState.mode === 'watermark') return `remove any watermarks, text, or logos from the image, meticulously inpainting the area to seamlessly match the surrounding content without leaving any artifacts.`;
        }
        if (tool === 'artify') { return toolState.selectedStyle; }
        return toolState.userInput;
    };
    
    let progressInterval = null;
    const generateImage = async () => {
        const toolState = state[state.activeTool];
        toolState.engineeredPrompt = createEngineeredPrompt(state.activeTool, toolState);
        
        const generateButton = document.getElementById('generate-button');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        generateButton.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        
        let progress = 0;
        clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            progress = Math.min(progress + 5, 95);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
        }, 500);

        try {
            const compressedFile = await compressImage(toolState.file);
            const base64Image = await fileToBase64(compressedFile);
            const response = await fetch('/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type, prompt: toolState.engineeredPrompt, width: toolState.dimensions.width, height: toolState.dimensions.height }),
            });
            clearInterval(progressInterval);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'The server returned an error.'); }
            const data = await response.json();
            if (data.edited_image_url) {
                progressBar.style.width = '100%';
                progressText.textContent = '100%';
                setTimeout(() => { progressText.innerHTML = `<span class="arrow-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></span>`; }, 500);
                setTimeout(() => { toolState.resultUrl = data.edited_image_url; toolState.view = 'result'; render(); }, 1500);
            } else { throw new Error('Could not find the edited image in the response.'); }
        } catch (error) { console.error('Generation failed:', error); alert(`Error: ${error.message}`); clearInterval(progressInterval); render(); }
    };

    const render = () => {
        const toolState = state[state.activeTool];
        const headers = {
            'prompt-edit': { title: 'Prompt Edit', subtitle: 'Use natural language to transform your image.' },
            'removal-tool': { title: 'Removal Tool', subtitle: 'Remove backgrounds, objects, or watermarks.' },
            'artify': { title: 'Artify', subtitle: 'Transform your image with creative styles.' }
        };
        const header = headers[state.activeTool];

        let viewContent = '';
        if (toolState.view === 'upload') {
            viewContent = `<section><input type="file" id="image-input" class="hidden" accept="image/*" /><div id="dropzone" class="dropzone rounded-lg p-10 text-center cursor-pointer"><svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg><p class="mt-4 text-lg font-medium">Click to upload or drag & drop</p><p class="text-sm text-secondary mt-1">PNG, JPG, or WEBP. Max 8MB.</p></div></section>`;
        } else if (toolState.view === 'edit') {
            let editControls = '';
            if (state.activeTool === 'prompt-edit') { editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe your edit:</label><textarea id="prompt-input" rows="3" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., add sunglasses to the corgi">${toolState.userInput || ''}</textarea></div>`; }
            else if (state.activeTool === 'removal-tool') { editControls = `<div class="my-4 space-y-2"><div class="flex items-center space-x-4 flex-wrap"><label class="flex items-center"><input type="radio" name="removal-mode" value="background" ${toolState.mode === 'background' ? 'checked' : ''} class="mr-2">Remove Background</label><label class="flex items-center"><input type="radio" name="removal-mode" value="object" ${toolState.mode === 'object' ? 'checked' : ''} class="mr-2">Remove Object</label><label class="flex items-center"><input type="radio" name="removal-mode" value="watermark" ${toolState.mode === 'watermark' ? 'checked' : ''} class="mr-2">Remove Watermark</label></div><div id="object-input-container" class="${toolState.mode === 'object' ? '' : 'hidden'}"><label for="object-input" class="block text-sm font-bold mb-2 mt-4">Object to remove:</label><input type="text" id="object-input" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., the cat on the right" value="${toolState.objectToRemove || ''}"></div></div>`; }
            else if (state.activeTool === 'artify') {
                const styles = {
                    'Master Artists': [ { name: 'Van Gogh', prompt: 'in the style of Van Gogh, expressive impasto brushstrokes', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7.25a2.25 2.25 0 0 0-2.25-2.25H6.25A2.25 2.25 0 0 0 4 7.25v9.5A2.25 2.25 0 0 0 6.25 19h11.5A2.25 2.25 0 0 0 20 16.75Z"/><path d="M16 5v14"/></svg>` }, { name: 'Monet', prompt: 'in the style of Monet, impressionism, soft light', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/></svg>` }, { name: 'Picasso', prompt: 'in the cubist style of Picasso, abstract, geometric', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.63 3.63 12 7.25l-3.63-3.62A2.5 2.5 0 0 0 4.75 5.5v13a2.5 2.5 0 0 0 2.5 2.5h13a2.5 2.5 0 0 0 2.5-2.5v-13a2.5 2.5 0 0 0-1.88-2.38Z"/></svg>` } ],
                    'Digital & Retro': [ { name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic city, cinematic lighting', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V9l6 8V9"/></svg>` }, { name: 'Pixel Art', prompt: '16-bit pixel art style, detailed, vibrant palette', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h4v4H3z"/><path d="M7 3h4v4H7z"/><path d="M11 3h4v4h-4z"/><path d="M15 3h4v4h-4z"/><path d="M3 7h4v4H3z"/><path d="M7 7h4v4H7z"/><path d="M11 7h4v4h-4z"/><path d="M15 7h4v4h-4z"/><path d="M3 11h4v4H3z"/><path d="M7 11h4v4H7z"/><path d="M11 11h4v4h-4z"/><path d="M15 11h4v4h-4z"/><path d="M3 15h4v4H3z"/><path d="M7 15h4v4H7z"/><path d="M11 15h4v4h-4z"/><path d="M15 15h4v4h-4z"/></svg>` }, { name: 'Voxel Art', prompt: 'voxel art, isometric, blocky, 3d pixels', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="m12 10 4 7H8Z"/></svg>` } ],
                    'Handcrafted & Physical': [ { name: 'LEGO', prompt: 'as a LEGO diorama, plastic brick texture, 3d render', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10c0-1.1-.9-2-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4Z"/><path d="M6 10c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-4Z"/></svg>` }, { name: 'Pencil Sketch', prompt: 'pencil sketch, hand-drawn, monochrome, detailed shading', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4.5 20 10l-4.5 4.5"/><path d="m20 10-16.5.012"/></svg>` }, { name: 'Claymation', prompt: 'claymation style, plasticine, stop-motion look', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z"/><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/></svg>` } ]
                };
                editControls = Object.entries(styles).map(([category, styleList]) => `
                    <div class="mb-6"><h3 class="style-category-title">${category}</h3><div class="style-grid">
                    ${styleList.map(s => `<div class="style-btn ${toolState.selectedStyle === s.prompt ? 'active' : ''}" data-style-prompt="${s.prompt}">${s.icon}<span>${s.name}</span></div>`).join('')}
                    </div></div>`).join('');
            }
            viewContent = `<section><div class="mb-4"><img id="image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>${editControls}<div class="mt-4 flex space-x-2"><button id="generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span>Generate</span></button><button id="reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button></div><div id="progress-container" class="mt-4 hidden"><div id="progress-bar" style="width: 0%;"></div><div id="progress-text">0%</div></div></section>`;
        } else if (toolState.view === 'result') {
            viewContent = `<section class="space-y-4"><div><h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3><p class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.userInput}"</p></div><div><label class="block text-sm font-bold text-secondary mb-2">Original</label><div class="result-image-container"><img src="${URL.createObjectURL(toolState.file)}"></div></div><div><label class="block text-sm font-bold text-secondary mb-2">Edited</label><div class="result-image-container"><img src="${toolState.resultUrl}"></div></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"><button id="download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button><button id="new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button></div></section>`;
        }
        
        contentContainer.innerHTML = `<div class="tool-wrapper">${headers[state.activeTool]}<div class="main-container p-6">${viewContent}</div></div>`;
        addEventListeners();
        if (toolState.view === 'result') {
            const resultContainers = contentContainer.querySelectorAll('.result-image-container');
            resultContainers.forEach(c => { c.style.aspectRatio = `${toolState.dimensions.width} / ${toolState.dimensions.height}`; });
        }
    };

    function addEventListeners() {
        const toolState = state[state.activeTool];
        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            const imageInput = document.getElementById('image-input');
            dropzone.addEventListener('click', () => imageInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
            imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
        }
        
        const generateButton = document.getElementById('generate-button');
        if(generateButton) { generateButton.addEventListener('click', () => {
                if (state.activeTool === 'prompt-edit') { toolState.userInput = document.getElementById('prompt-input').value; }
                else if (state.activeTool === 'removal-tool') {
                    toolState.mode = document.querySelector('input[name="removal-mode"]:checked').value;
                    if (toolState.mode === 'object') { toolState.objectToRemove = document.getElementById('object-input').value; }
                }
                else if (state.activeTool === 'artify') { if (!toolState.selectedStyle) { alert('Please select a style!'); return; } const styleName = document.querySelector(`#artify .style-btn.active span`).textContent; toolState.userInput = `Artify with ${styleName} style`; }
                generateImage();
        });}

        const resetButton = document.getElementById('reset-button');
        if(resetButton) resetButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; toolState.userInput = ''; render(); });
        
        const removalModeRadios = document.querySelectorAll('input[name="removal-mode"]');
        if (removalModeRadios) { removalModeRadios.forEach(radio => { radio.addEventListener('change', (e) => { toolState.mode = e.target.value; document.getElementById('object-input-container').classList.toggle('hidden', e.target.value !== 'object'); }); }); }

        const styleBtns = document.querySelectorAll('.style-btn');
        if (styleBtns) { styleBtns.forEach(btn => { btn.addEventListener('click', () => { styleBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); toolState.selectedStyle = btn.dataset.stylePrompt; }); }); }
        
        const newEditButton = document.getElementById('new-edit-button');
        if(newEditButton) newEditButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; toolState.userInput = ''; render(); });
        
        const downloadButton = document.getElementById('download-button');
        if (downloadButton) { downloadButton.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(toolState.resultUrl);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'kamuy-edit.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch (error) { console.error("Download failed:", error); alert("Could not download the image."); }
        }); }
    }

    const handleFileSelect = (file) => {
        const toolState = state[state.activeTool];
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
        toolState.file = file;
        const img = new Image();
        img.onload = () => { toolState.dimensions = { width: img.naturalWidth, height: img.naturalHeight }; toolState.view = 'edit'; render(); };
        img.src = URL.createObjectURL(file);
    };

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

    render();
});
