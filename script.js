document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const mainContent = document.getElementById('main-content');

    const state = {
        activeTool: 'prompt-edit',
        'prompt-edit': { file: null, prompt: '', negative_prompt: '', dimensions: { width: 0, height: 0 }, view: 'upload' },
        'removal-tool': { file: null, prompt: '', negative_prompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', mode: 'background', objectToRemove: '' },
        'artify': { file: null, prompt: '', negative_prompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', selectedStyle: null }
    };

    const toolInfo = {
        'prompt-edit': { title: 'Prompt Edit', description: 'Use natural language to transform your image.'},
        'removal-tool': { title: 'Removal Tool', description: 'Remove backgrounds, objects, or watermarks.'},
        'artify': { title: 'Artify', description: 'Transform your image with creative styles.'}
    };

    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); state.activeTool = link.dataset.tool; navLinks.forEach(l => l.classList.remove('active')); link.classList.add('active'); render(); });
    });

    const generateImage = async (toolState) => {
        const generateButton = document.getElementById('generate-button');
        if (!generateButton) return;
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
                body: JSON.stringify({ image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type, prompt: toolState.prompt, negative_prompt: toolState.negative_prompt, width: toolState.dimensions.width, height: toolState.dimensions.height, task_type: state.activeTool }),
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
            if(document.getElementById('generate-button')) {
                generateButton.disabled = false;
                generateLoader.classList.add('hidden');
                generateButtonText.textContent = 'Generate';
            }
        }
    };

    function render() {
        const toolState = state[state.activeTool];
        const info = toolInfo[state.activeTool];
        let contentHTML = '';

        if (toolState.view === 'upload') {
            contentHTML = `<section><input type="file" id="image-input" class="hidden" accept="image/*" /><div id="dropzone" class="dropzone rounded-lg p-10 text-center cursor-pointer"><svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg><p class="mt-4 text-lg font-medium">Click to upload or drag & drop</p><p class="text-sm text-secondary mt-1">PNG, JPG, or WEBP. Max 8MB.</p></div></section>`;
        } else if (toolState.view === 'edit') {
            let editControls = '';
            if (state.activeTool === 'prompt-edit') {
                 editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe your edit:</label><textarea id="prompt-input" rows="3" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., Change the red shirts to green">${toolState.prompt || ''}</textarea></div>`;
            } else if (state.activeTool === 'removal-tool') {
                editControls = `<div class="my-4 space-y-2"><div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center"><input type="radio" name="removal-mode" value="background" ${toolState.mode === 'background' ? 'checked' : ''} class="mr-2">Remove Background</label>
                    <label class="flex items-center"><input type="radio" name="removal-mode" value="object" ${toolState.mode === 'object' ? 'checked' : ''} class="mr-2">Remove Object</label>
                    <label class="flex items-center"><input type="radio" name="removal-mode" value="watermark" ${toolState.mode === 'watermark' ? 'checked' : ''} class="mr-2">Remove Watermark</label>
                </div><div id="object-input-container" class="${toolState.mode === 'object' ? '' : 'hidden'} mt-4"><label for="object-input" class="block text-sm font-bold mb-2">Object to remove:</label><input type="text" id="object-input" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., the person in the background" value="${toolState.objectToRemove || ''}"></div></div>`;
            } else if (state.activeTool === 'artify') {
                const styles = [
                    { name: 'Anime', prompt: 'masterpiece, anime style, vibrant, detailed, studio ghibli style'},
                    { name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic city, cinematic lighting, highly detailed'},
                    { name: 'Van Gogh', prompt: 'in the style of Van Gogh, expressive impasto brushstrokes, vibrant colors'},
                    { name: 'Watercolor', prompt: 'watercolor painting, soft wash, flowing colors, detailed'},
                    { name: 'Pop Art', prompt: 'Pop Art style, bold colors, graphic novel aesthetic, halftone dots'},
                    { name: 'Sketch', prompt: 'pencil sketch, hand-drawn, monochrome, detailed shading, high contrast'},
                ];
                let styleGridHTML = styles.map(s => `<button class="style-btn ${toolState.selectedStyle === s.prompt ? 'active' : ''}" data-style-prompt="${s.prompt}">${s.name}</button>`).join('');
                editControls = `<div class="my-4"><label class="block text-sm font-bold mb-2">Choose a style:</label><div class="style-grid">${styleGridHTML}</div></div>`;
            }
            contentHTML = `<section><div class="mb-4"><img id="image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>${editControls}<div class="mt-4 flex space-x-2"><button id="generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span>Generate</span><div class="loader w-5 h-5 rounded-full border-2 hidden ml-2"></div></button><button id="reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button></div></section>`;
        } else if (toolState.view === 'result') {
            contentHTML = `<section class="space-y-4"><div><h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3><p class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.prompt}"</p></div><div><label class="block text-sm font-bold text-secondary mb-2">Original</label><img src="${URL.createObjectURL(toolState.file)}" class="rounded-lg border border-primary w-full"></div><div><label class="block text-sm font-bold text-secondary mb-2">Edited</label><img src="${toolState.resultUrl}" class="rounded-lg border border-primary w-full"></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"><button id="download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button><button id="new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button></div></section>`;
        }
        
        mainContent.innerHTML = `<div class="w-full max-w-3xl mx-auto"><header class="tool-header"><h2 class="text-3xl font-bold">${info.title}</h2><p class="text-lg text-secondary">${info.description}</p></header><div class="main-container p-6">${contentHTML}</div></div>`;
        addEventListeners();
    };

    function addEventListeners() {
        const toolState = state[state.activeTool];
        const dropzone = document.getElementById("dropzone");
        if (dropzone) {
            const imageInput = document.getElementById("image-input");
            dropzone.addEventListener('click', () => imageInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
            imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
        }
        
        const generateButton = document.getElementById('generate-button');
        if(generateButton) {
            generateButton.addEventListener('click', () => {
                toolState.negative_prompt = 'blurry, noisy, distorted, malformed, watermark, bad quality, artifacts, bad anatomy, mutated hands, disfigured faces, extra limbs, poor details';
                
                if (state.activeTool === 'prompt-edit') {
                    const userInput = document.getElementById('prompt-input').value;
                    toolState.prompt = `${userInput}, keeping all other elements and the overall style unchanged. Preserve all facial features, skin tones, and background elements not mentioned in the prompt.`;
                } else if (state.activeTool === 'removal-tool') {
                    if (toolState.mode === 'background') { toolState.prompt = 'remove the background, keeping the subject perfectly intact. Output with a transparent background. Do not add a watermark.'; }
                    else if (toolState.mode === 'object') {
                        toolState.objectToRemove = document.getElementById('object-input').value;
                        if (!toolState.objectToRemove) { alert('Please specify an object to remove.'); return; }
                        toolState.prompt = `remove the ${toolState.objectToRemove}, inpainting the area to match the background naturally. The final image must have the same dimensions and aspect ratio as the original. Keep all other parts of the image unchanged.`;
                    } else if (toolState.mode === 'watermark') { toolState.prompt = `remove the watermark from the image, meticulously inpainting the area to seamlessly match the surrounding content without leaving any artifacts.`; }
                } else if (state.activeTool === 'artify') {
                    if (!toolState.selectedStyle) { alert('Please select a style!'); return; }
                    toolState.prompt = `transform the image in a ${toolState.selectedStyle}. Preserve the original composition and subject poses.`;
                    toolState.negative_prompt += ', realistic, photo, real life, photograph';
                }
                generateImage(toolState);
            });
        }

        const resetButton = document.getElementById('reset-button');
        if(resetButton) resetButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; render(); });
        
        const removalModeRadios = document.querySelectorAll('input[name="removal-mode"]');
        if (removalModeRadios) {
            removalModeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => { toolState.mode = e.target.value; document.getElementById('object-input-container').classList.toggle('hidden', e.target.value !== 'object'); });
            });
        }

        const styleBtns = document.querySelectorAll('.style-btn');
        if (styleBtns) {
            styleBtns.forEach(btn => {
                btn.addEventListener('click', () => { styleBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); toolState.selectedStyle = btn.dataset.stylePrompt; });
            });
        }
        
        const newEditButton = document.getElementById('new-edit-button');
        if(newEditButton) newEditButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; render(); });
        
        const downloadButton = document.getElementById('download-button');
        if (downloadButton) {
            downloadButton.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(toolState.resultUrl); const blob = await response.blob(); const url = URL.createObjectURL(blob);
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
