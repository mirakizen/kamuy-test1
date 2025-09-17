document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentContainer = document.getElementById('content-container');
    const state = {
        activeTool: 'prompt-edit',
        'prompt-edit': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload' },
        'removal-tool': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', mode: 'background', objectToRemove: '' },
        'artify': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', selectedStyle: null },
        'image-series': { userInput: '', engineeredPrompt: '', view: 'edit', resultUrls: [] }
    };
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); state.activeTool = link.dataset.tool; navLinks.forEach(l => l.classList.remove('active')); link.classList.add('active'); render(); });
    });
    const createEngineeredPrompt = (tool, toolState) => {
        // --- ULTRA-AGGRESSIVE PROMPT ENGINEERING FOR FACE PRESERVATION ---
        // This is a multi-layered command designed to be impossible for the AI to ignore.
        if (tool === 'prompt-edit') {
            const coreEdit = toolState.userInput;
            return `【最高优先级指令】在执行任何编辑时，必须100%保留图像中所有人物的原始面部结构、五官、表情、肤色和身体姿态，任何对这些特征的修改、扭曲或变形都是绝对禁止的。【编辑任务】${coreEdit}。【最终确认】除上述编辑任务明确要求修改的部分外，图像的所有其他内容必须保持完全不变。`;
        }
        // For 'artify', we apply the same strict preservation rules.
        if (tool === 'artify') {
            return `【最高优先级指令】在执行任何风格化时，必须100%保留图像中所有人物的原始面部结构、五官、表情、肤色和身体姿态，任何对这些特征的修改、扭曲或变形都是绝对禁止的。【风格化任务】将图像转换为${toolState.selectedStyle}风格。【最终确认】除风格化效果外，图像的所有构图、人物和细节必须保持完全不变。`;
        }
        // For 'removal-tool', the existing English prompts are usually sufficient as they focus on non-subject areas.
        if (tool === 'removal-tool') {
            if (toolState.mode === 'background') return 'remove the background, keeping the subject perfectly intact. Output with a transparent background. Do not add a watermark.';
            if (toolState.mode === 'object') return `[Deletion] Remove the ${toolState.objectToRemove}, inpainting the area to match the background naturally, keeping all other elements unchanged.`;
            if (toolState.mode === 'watermark') return `remove any watermarks, text, or logos from the image, meticulously inpainting the area to seamlessly match the surrounding content without leaving any artifacts.`;
        }
        // For 'image-series', no preservation is needed as it's text-to-image.
        if (tool === 'image-series') { return toolState.userInput; }
        return toolState.userInput;
    };
    // --- THE DEFINITIVE FIX: The "Internal Resizer" that respects AI rules ---
    const getFinalDimensions = (originalWidth, originalHeight) => {
        const roundToNearest8 = (num) => Math.round(num / 8) * 8;
        const MAX_OUTPUT_DIMENSION = 1024;
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        if (targetWidth > MAX_OUTPUT_DIMENSION || targetHeight > MAX_OUTPUT_DIMENSION) {
            const aspectRatio = targetWidth / targetHeight;
            if (targetWidth > targetHeight) {
                targetWidth = MAX_OUTPUT_DIMENSION;
                targetHeight = MAX_OUTPUT_DIMENSION / aspectRatio;
            } else {
                targetHeight = MAX_OUTPUT_DIMENSION;
                targetWidth = MAX_OUTPUT_DIMENSION * aspectRatio;
            }
        }
        return { 
            width: roundToNearest8(targetWidth), 
            height: roundToNearest8(targetHeight) 
        };
    };
    let progressInterval = null;
    const generateImage = async () => {
        const toolState = state[state.activeTool];
        toolState.engineeredPrompt = createEngineeredPrompt(state.activeTool, toolState);
        const outputDimensions = getFinalDimensions(toolState.dimensions.width, toolState.dimensions.height);
        const generateButton = document.getElementById('generate-button');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        generateButton.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        let progress = 0;
        clearInterval(progressInterval);
        progressInterval = setInterval(() => { progress = Math.min(progress + 5, 95); progressBar.style.width = `${progress}%`; progressText.textContent = `${progress}%`; }, 500);
        try {
            const isTextToImage = state.activeTool === 'image-series';
            const endpoint = isTextToImage ? '/api/series' : '/api/edit';
            let body = { prompt: toolState.engineeredPrompt, width: outputDimensions.width, height: outputDimensions.height };
            if (!isTextToImage) {
                const compressedFile = await compressImage(toolState.file);
                const base64Image = await fileToBase64(compressedFile);
                body = { ...body, image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type };
            }
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            clearInterval(progressInterval);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'The server returned an error.'); }
            const data = await response.json();
            progressBar.style.width = '100%'; progressText.textContent = '100%';
            setTimeout(() => { progressText.innerHTML = `<span class="arrow-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></span>`; }, 500);
            setTimeout(() => {
                if (isTextToImage && data.edited_image_urls) { toolState.resultUrls = data.edited_image_urls; }
                else if (!isTextToImage && data.edited_image_url) { toolState.resultUrl = data.edited_image_url; }
                else { throw new Error('Could not find image(s) in the response.'); }
                toolState.view = 'result';
                render();
            }, 1500);
        } catch (error) { console.error('Generation failed:', error); alert(`Error: ${error.message}`); clearInterval(progressInterval); render(); }
    };
    const render = () => {
        const toolState = state[state.activeTool];
        const headers = {
            'prompt-edit': { title: 'Prompt Edit', subtitle: 'Use natural language to transform your image.' },
            'removal-tool': { title: 'Removal Tool', subtitle: 'Remove backgrounds, objects, or watermarks.' },
            'artify': { title: 'Artify', subtitle: 'Transform your image with creative styles.' },
            'image-series': { title: 'Image Series', subtitle: 'Generate a sequence of images from a single prompt.' }
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
                const styles = { 'Master Artists': [ { name: 'Van Gogh', prompt: 'in the style of Van Gogh, expressive impasto brushstrokes'}, { name: 'Monet', prompt: 'in the style of Monet, impressionism, soft light' }, { name: 'Picasso', prompt: 'in the cubist style of Picasso, abstract, geometric' } ], 'Digital & Retro': [ { name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic city, cinematic lighting' }, { name: 'Pixel Art', prompt: '16-bit pixel art style' }, { name: 'Voxel Art', prompt: 'voxel art, isometric, blocky, 3d pixels' } ], 'Handcrafted & Physical': [ { name: 'LEGO', prompt: 'as a LEGO diorama, plastic brick texture' }, { name: 'Pencil Sketch', prompt: 'pencil sketch, hand-drawn, monochrome' }, { name: 'Claymation', prompt: 'claymation style, plasticine, stop-motion look' } ] };
                editControls = Object.entries(styles).map(([category, styleList]) => `<div class="mb-6"><h3 class="style-category-title">${category}</h3><div class="style-grid">${styleList.map(s => `<div class="style-btn ${toolState.selectedStyle === s.prompt ? 'active' : ''}" data-style-prompt="${s.prompt}"><span>${s.name}</span></div>`).join('')}</div></div>`).join('');
            } else if (state.activeTool === 'image-series') {
                 editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe the series of images you want to create:</label><textarea id="prompt-input" rows="5" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., a set of 4 icons for a weather app in a minimalist style">${toolState.userInput || ''}</textarea></div>`;
            }
            const imagePreviewHTML = state.activeTool !== 'image-series' ? `<div class="mb-4" id="image-preview-container"><img id="image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>` : '';
            viewContent = `<section>${imagePreviewHTML}${editControls}<div class="mt-4 flex space-x-2"><button id="generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span>Generate</span></button><button id="reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button></div><div id="progress-container" class="mt-4 hidden"><div id="progress-bar" style="width: 0%;"></div><div id="progress-text">0%</div></div></section>`;
        } else if (toolState.view === 'result') {
            let resultHTML = '';
            if (state.activeTool === 'image-series') { resultHTML = `<div class="style-grid">${toolState.resultUrls.map(url => `<div class="result-image-container"><img src="${url}"></div>`).join('')}</div>`; }
            else { resultHTML = `<div><label class="block text-sm font-bold text-secondary mb-2">Original</label><div class="result-image-container"><img src="${URL.createObjectURL(toolState.file)}"></div></div><div><label class="block text-sm font-bold text-secondary mb-2">Edited</label><div class="result-image-container"><img src="${toolState.resultUrl}"></div></div>`; }
            const downloadButtonHTML = state.activeTool !== 'image-series' ? `<button id="download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button>` : `<div class="text-sm text-secondary text-center">Right-click on an image to save.</div>`;
            viewContent = `<section class="space-y-4"><div><h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3><p class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.userInput}"</p></div>${resultHTML}<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">${downloadButtonHTML}<button id="new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button></div></section>`;
        }
        contentContainer.innerHTML = `<header class="tool-header"><h2 class="text-3xl font-bold">${header.title}</h2><p class="text-lg text-secondary">${header.subtitle}</p></header><div class="main-container p-6">${viewContent}</div>`;
        addEventListeners();
        if (toolState.view === 'result' && state.activeTool !== 'image-series') {
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
                else if (state.activeTool === 'removal-tool') { toolState.mode = document.querySelector('input[name="removal-mode"]:checked').value; if (toolState.mode === 'object') { toolState.objectToRemove = document.getElementById('object-input').value; } }
                else if (state.activeTool === 'artify') {
                    if (!toolState.selectedStyle) { alert('Please select a style!'); return; }
                    const activeBtn = document.querySelector('.style-btn.active');
                    const styleName = activeBtn.querySelector('span').textContent;
                    toolState.userInput = `Artify with ${styleName} style`;
                }
                else if (state.activeTool === 'image-series') { toolState.userInput = document.getElementById('prompt-input').value; }
                generateImage();
        });}
        const resetButton = document.getElementById('reset-button');
        if(resetButton) resetButton.addEventListener('click', () => { toolState.view = 'upload'; toolState.file = null; toolState.userInput = ''; render(); });
        const removalModeRadios = document.querySelectorAll('input[name="removal-mode"]');
        if (removalModeRadios) { removalModeRadios.forEach(radio => { radio.addEventListener('change', (e) => { toolState.mode = e.target.value; document.getElementById('object-input-container').classList.toggle('hidden', e.target.value !== 'object'); }); }); }
        const styleBtns = document.querySelectorAll('.style-btn');
        if (styleBtns) { styleBtns.forEach(btn => { btn.addEventListener('click', () => { styleBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); toolState.selectedStyle = btn.dataset.stylePrompt; }); }); }
        const newEditButton = document.getElementById('new-edit-button');
        if(newEditButton) newEditButton.addEventListener('click', () => { toolState.view = toolState.file ? 'edit' : 'upload'; render(); });
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
            if (width > maxDim || height > maxDim) {
                if (width > height) { height = (height / width) * maxDim; width = maxDim; } else { width = (width / height) * maxDim; height = maxDim; }
            }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => { URL.revokeObjectURL(img.src); resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); }, 'image/jpeg', 0.95);
        };
        img.onerror = reject;
    });
    render();
});
