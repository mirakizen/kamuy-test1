document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const toolSections = document.querySelectorAll('.tool-section');

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
            toolSections.forEach(section => section.classList.remove('active'));
            document.getElementById(state.activeTool).classList.add('active');
            render();
        });
    });

    const generateImage = async (toolState) => {
        const generateButton = document.querySelector(`#${state.activeTool} button[id^="generate-"]`);
        const generateButtonText = generateButton.querySelector('span');
        const generateLoader = generateButton.querySelector('div');
        generateButton.disabled = true;
        generateLoader.classList.remove('hidden');
        generateButtonText.textContent = 'Generating...';
        try {
            const compressedFile = await compressImage(toolState.file);
            const base64Image = await fileToBase64(compressedFile);
            const response = await fetch('/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type, prompt: toolState.engineeredPrompt, width: toolState.dimensions.width, height: toolState.dimensions.height }),
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
            if (document.getElementById(`${state.activeTool}-generate-button`)) {
                generateButton.disabled = false;
                generateLoader.classList.add('hidden');
                generateButtonText.textContent = 'Generate';
            }
        }
    };

    // --- NEW RENDER LOGIC ---
    const render = () => {
        const toolState = state[state.activeTool];
        const sectionContainer = document.getElementById(state.activeTool); // Target the main section
        if (!sectionContainer) return;

        let content = '';
        const toolHeaders = {
            'prompt-edit': `<header class="tool-header"><h2 class="text-3xl font-bold">Prompt Edit</h2><p class="text-lg text-secondary">Use natural language to transform your image.</p></header>`,
            'removal-tool': `<header class="tool-header"><h2 class="text-3xl font-bold">Removal Tool</h2><p class="text-lg text-secondary">Remove backgrounds, objects, or watermarks.</p></header>`,
            'artify': `<header class="tool-header"><h2 class="text-3xl font-bold">Artify</h2><p class="text-lg text-secondary">Transform your image with creative styles.</p></header>`
        };

        let viewContent = '';
        if (toolState.view === 'upload') {
            viewContent = `<section><input type="file" id="${state.activeTool}-image-input" class="hidden" accept="image/*" /><div id="${state.activeTool}-dropzone" class="dropzone rounded-lg p-10 text-center cursor-pointer"><svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg><p class="mt-4 text-lg font-medium">Click to upload or drag & drop</p><p class="text-sm text-secondary mt-1">PNG, JPG, or WEBP. Max 8MB.</p></div></section>`;
        } else if (toolState.view === 'edit') {
            let editControls = '';
            if (state.activeTool === 'prompt-edit') { editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe your edit:</label><textarea id="prompt-input" rows="3" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., Change the corgi into a felt wool figure">${toolState.userInput || ''}</textarea></div>`; }
            else if (state.activeTool === 'removal-tool') { editControls = `<div class="my-4 space-y-2"><div class="flex items-center space-x-4"><label class="flex items-center"><input type="radio" name="removal-mode" value="background" ${toolState.mode === 'background' ? 'checked' : ''} class="mr-2">Remove Background</label><label class="flex items-center"><input type="radio" name="removal-mode" value="object" ${toolState.mode === 'object' ? 'checked' : ''} class="mr-2">Remove Object</label><label class="flex items-center"><input type="radio" name="removal-mode" value="watermark" ${toolState.mode === 'watermark' ? 'checked' : ''} class="mr-2">Remove Watermark</label></div><div id="object-input-container" class="${toolState.mode === 'object' ? '' : 'hidden'}"><label for="object-input" class="block text-sm font-bold mb-2">Object to remove:</label><input type="text" id="object-input" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., the red car" value="${toolState.objectToRemove || ''}"></div></div>`; }
            else if (state.activeTool === 'artify') {
                const styles = [ { name: 'Anime', prompt: 'anime style, vibrant, detailed, studio ghibli', img: 'https://storage.googleapis.com/static.fal.ai/static/images/8b072591-c454-4286-a24a-1b57221e7842.jpeg' }, { name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic city, cinematic lighting', img: 'https://storage.googleapis.com/static.fal.ai/static/images/1e485e50-f831-48d6-a077-0c75402a5e44.jpeg' }, { name: 'Van Gogh', prompt: 'in the style of Van Gogh, expressive impasto brushstrokes', img: 'https://storage.googleapis.com/static.fal.ai/static/images/a0e1b033-a337-4148-a0fd-1481b764b8a4.jpeg' }, { name: 'Pixel Art', prompt: '16-bit pixel art style, detailed, vibrant palette', img: 'https://storage.googleapis.com/static.fal.ai/static/images/862089f8-22fd-4a1a-9a9c-a15d7f1b7a2d.jpeg' }, { name: 'Sketch', prompt: 'pencil sketch, hand-drawn, monochrome, detailed shading', img: 'https://storage.googleapis.com/static.fal.ai/static/images/4295e89a-a82f-4824-85b5-227563f03b5f.jpeg' }, { name: 'LEGO', prompt: 'as a LEGO diorama, plastic brick texture, 3d render', img: 'https://storage.googleapis.com/static.fal.ai/static/images/b216d4c6-9937-44ab-8a50-02588c757c2a.jpeg' }];
                let styleGridHTML = styles.map(s => `<div class="style-btn ${toolState.selectedStyle === s.prompt ? 'active' : ''}" data-style-prompt="${s.prompt}"><img src="${s.img}" alt="${s.name} style preview"><span>${s.name}</span></div>`).join('');
                editControls = `<div class="my-4"><label class="block text-sm font-bold mb-2">Choose a style:</label><div class="style-grid">${styleGridHTML}</div></div>`;
            }
            viewContent = `<section><div class="mb-4"><img id="${state.activeTool}-image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>${editControls}<div class="mt-4 flex space-x-2"><button id="${state.activeTool}-generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span>Generate</span><div class="loader w-5 h-5 rounded-full border-2 hidden ml-2"></div></button><button id="${state.activeTool}-reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button></div></section>`;
        } else if (toolState.view === 'result') {
            viewContent = `<section class="space-y-4"><div><h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3><p class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.userInput}"</p></div><div><label class="block text-sm font-bold text-secondary mb-2">Original</label><div class="result-image-container"><img src="${URL.createObjectURL(toolState.file)}"></div></div><div><label class="block text-sm font-bold text-secondary mb-2">Edited</label><div class="result-image-container"><img src="${toolState.resultUrl}"></div></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"><button id="${state.activeTool}-download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button><button id="${state.activeTool}-new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button></div></section>`;
        }
        
        sectionContainer.innerHTML = `<div class="w-full max-w-3xl mx-auto">${toolHeaders[state.activeTool]}<div class="main-container p-6">${viewContent}</div></div>`;
        addEventListeners();

        if (toolState.view === 'result') {
            const resultContainers = sectionContainer.querySelectorAll('.result-image-container');
            resultContainers.forEach(c => { c.style.aspectRatio = `${toolState.dimensions.width} / ${toolState.dimensions.height}`; });
        }
    };

    function addEventListeners() {
        const toolState = state[state.activeTool];
        const dropzone = document.getElementById(`${state.activeTool}-dropzone`);
        if (dropzone) {
            const imageInput = document.getElementById(`${state.activeTool}-image-input`);
            dropzone.addEventListener('click', () => imageInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
            imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
        }
        
        const generateButton = document.getElementById(`${state.activeTool}-generate-button`);
        if(generateButton) {
            generateButton.addEventListener('click', () => {
                const preservationPrompt = " Preserve all facial features, skin tones, and background elements not mentioned in the prompt. Keep the overall style unchanged.";
                if (state.activeTool === 'prompt-edit') {
                    toolState.userInput = document.getElementById('prompt-input').value;
                    toolState.engineeredPrompt = toolState.userInput + preservationPrompt;
                } else if (state.activeTool === 'removal-tool') {
                    if (toolState.mode === 'background') { toolState.userInput = 'Remove background'; toolState.engineeredPrompt = 'remove the background, keeping the subject. Output with a transparent background. Do not add a watermark.'; }
                    else if (toolState.mode === 'object') {
                        toolState.objectToRemove = document.getElementById('object-input').value;
                        if (!toolState.objectToRemove) { alert('Please specify an object to remove.'); return; }
                        toolState.userInput = `Remove "${toolState.objectToRemove}"`;
                        toolState.engineeredPrompt = `[Deletion] Remove the ${toolState.objectToRemove}, inpainting the area to match the background naturally, keeping all other elements unchanged.`;
                    } else if (toolState.mode === 'watermark') { toolState.userInput = 'Remove watermark'; toolState.engineeredPrompt = `remove the watermark from the image, meticulously inpainting the area to seamlessly match the surrounding content without leaving any artifacts.`; }
                } else if (state.activeTool === 'artify') {
                    if (!toolState.selectedStyle) { alert('Please select a style!'); return; }
                    const styleName = document.querySelector(`#artify .style-btn.active span`).textContent;
                    toolState.userInput = `Artify with ${styleName} style`;
                    toolState.engineeredPrompt = toolState.selectedStyle;
                }
                generateImage(toolState);
            });
        }

        const resetButton = document.getElementById(`${state.activeTool}-reset-button`);
        if(resetButton) resetButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; toolState.userInput = ''; render(); });
        
        const removalModeRadios = document.querySelectorAll('input[name="removal-mode"]');
        if (removalModeRadios) {
            removalModeRadios.forEach(radio => { radio.addEventListener('change', (e) => { toolState.mode = e.target.value; document.getElementById('object-input-container').classList.toggle('hidden', e.target.value !== 'object'); }); });
        }

        const styleBtns = document.querySelectorAll('.style-btn');
        if (styleBtns) {
            styleBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    styleBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    toolState.selectedStyle = btn.dataset.stylePrompt;
                });
            });
        }
        
        const newEditButton = document.getElementById(`${state.activeTool}-new-edit-button`);
        if(newEditButton) newEditButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; toolState.userInput = ''; render(); });
        
        const downloadButton = document.getElementById(`${state.activeTool}-download-button`);
        if (downloadButton) {
            downloadButton.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(toolState.resultUrl);
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'kamuy-edit.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch (error) { console.error("Download failed:", error); alert("Could not download the image."); }
            });
        }
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
