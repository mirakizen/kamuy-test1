document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentContainer = document.getElementById('content-container');
    const state = {
        activeTool: 'prompt-edit',
        'prompt-edit': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', selectedAspectRatio: 'original', outputDimensions: null },
        'removal-tool': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'select-mode', mode: 'background', objectToRemove: '', selectedAspectRatio: 'original', outputDimensions: null, selectedSubTool: null },
        'artify': { file: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'select-mode', selectedStyle: null, selectedAspectRatio: 'original', outputDimensions: null, selectedSubTool: null },
        'image-series': { userInput: '', engineeredPrompt: '', view: 'edit', resultUrls: [], selectedAspectRatio: 'original', outputDimensions: null },
        'brand-it': { mainFile: null, logoFile: null, userInput: '', engineeredPrompt: '', dimensions: { width: 0, height: 0 }, view: 'upload', selectedAspectRatio: 'original', outputDimensions: null }
    };
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newTool = link.dataset.tool;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            if (newTool === 'removal-tool' || newTool === 'artify') {
                state.activeTool = newTool;
                state[newTool].view = 'select-mode'; // Go to mode selection for these tools
            } else if (newTool === 'brand-it') {
                state.activeTool = newTool;
                state[newTool].view = 'upload'; // Brand It! starts with uploads
            } else {
                state.activeTool = newTool;
                state[newTool].view = state[newTool].file ? 'edit' : 'upload';
            }
            render();
        });
    });
    const createEngineeredPrompt = (tool, toolState) => {
        if (tool === 'prompt-edit') {
            const coreEdit = toolState.userInput;
            return `Precisely execute the following edit: ${coreEdit}. During execution, strictly preserve the original details, textures, and clarity of all non-edited areas in the image, including human faces, skin, text, patterns, and background. The edit must be natural, seamless, and free from any blur, distortion, or artifacts.`;
        }
        if (tool === 'artify') {
            return `Transform the image into ${toolState.selectedStyle} style. During stylization, all human facial features must remain clearly recognizable, and all text and pattern details must be completely intact. The final result should be a perfect fusion of style and original details.`;
        }
        if (tool === 'removal-tool') {
            if (toolState.mode === 'background') return 'remove the background, keeping the subject perfectly intact. Output with a transparent background. Do not add a watermark.';
            if (toolState.mode === 'object') return `[Deletion] Remove the ${toolState.objectToRemove}, inpainting the area to match the background naturally, keeping all other elements unchanged.`;
            if (toolState.mode === 'watermark') return `remove any watermarks, text, or logos from the image, meticulously inpainting the area to seamlessly match the surrounding content without leaving any artifacts.`;
        }
        if (tool === 'image-series') { return toolState.userInput; }
        // For brand-it, the engineered prompt is handled server-side in api/brand.js
        if (tool === 'brand-it') { return toolState.userInput; }
        return toolState.userInput;
    };
    const getFinalDimensions = (originalWidth, originalHeight, selectedAspectRatio) => {
        const roundToNearest8 = (num) => Math.round(num / 8) * 8;
        const MAX_DIM = 4096;
        const MIN_DIM = 1024;

        let targetWidth, targetHeight;
        let finalAspectRatio;

        if (selectedAspectRatio === 'original' || !originalWidth || !originalHeight) {
            // If original dimensions are not available or 'original' is selected,
            // we default to a square max if no specific aspect ratio is forced.
            if (!originalWidth || !originalHeight) {
                originalWidth = MAX_DIM;
                originalHeight = MAX_DIM;
            }
            finalAspectRatio = originalWidth / originalHeight;
        } else {
            let ratioW, ratioH;
            switch (selectedAspectRatio) {
                case '1:1': ratioW = 1; ratioH = 1; break;
                case '4:3': ratioW = 4; ratioH = 3; break;
                case '3:4': ratioW = 3; ratioH = 4; break;
                case '16:9': ratioW = 16; ratioH = 9; break;
                case '9:16': ratioH = 16; ratioW = 9; break; // Corrected for 9:16
                default: ratioW = 1; ratioH = 1;
            }
            finalAspectRatio = ratioW / ratioH;
        }

        if (finalAspectRatio >= 1) { // Landscape or Square
            targetWidth = MAX_DIM;
            targetHeight = MAX_DIM / finalAspectRatio;
        } else { // Portrait
            targetHeight = MAX_DIM;
            targetWidth = MAX_DIM * finalAspectRatio;
        }

        targetWidth = roundToNearest8(Math.round(targetWidth));
        targetHeight = roundToNearest8(Math.round(targetHeight));

        // Ensure minimum dimensions
        if (targetWidth < MIN_DIM || targetHeight < MIN_DIM) {
            if (finalAspectRatio >= 1) { // Landscape or Square
                targetHeight = MIN_DIM;
                targetWidth = MIN_DIM * finalAspectRatio;
            } else { // Portrait
                targetWidth = MIN_DIM;
                targetHeight = MIN_DIM / finalAspectRatio;
            }
            targetWidth = roundToNearest8(Math.round(targetWidth));
            targetHeight = roundToNearest8(Math.round(targetHeight));
        }

        // Re-check max dimensions after min adjustment to prevent exceeding
        if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
            const currentAspectRatio = targetWidth / targetHeight;
            if (currentAspectRatio > 1) { // Landscape
                targetWidth = MAX_DIM;
                targetHeight = MAX_DIM / currentAspectRatio;
            } else { // Portrait
                targetHeight = MAX_DIM;
                targetWidth = MAX_DIM * currentAspectRatio;
            }
            targetWidth = roundToNearest8(Math.round(targetWidth));
            targetHeight = roundToNearest8(Math.round(targetHeight));
        }

        return {
            width: targetWidth,
            height: targetHeight
        };
    };

    let progressInterval = null;
    const generateImage = async () => {
        const toolState = state[state.activeTool];
        const isTextToImage = state.activeTool === 'image-series';
        const isBrandIt = state.activeTool === 'brand-it';

        if (!isBrandIt && !isTextToImage && !toolState.file) { alert('Please upload an image first.'); return; }
        if (isBrandIt && !toolState.logoFile) { alert('Please upload a brand logo.'); return; }
        if (isBrandIt && !toolState.userInput) { alert('Please enter a prompt for your brand design.'); return; }
        if (!isBrandIt && !isTextToImage && !toolState.userInput) { alert('Please enter your edit description.'); return; }
        if (state.activeTool === 'artify' && !toolState.selectedStyle) { alert('Please select an art style!'); return; }


        toolState.engineeredPrompt = createEngineeredPrompt(state.activeTool, toolState);
        
        let originalWidth = toolState.dimensions.width || 1024;
        let originalHeight = toolState.dimensions.height || 1024;

        // For image-series and brand-it, if no main image, default dimensions to a square.
        if (isTextToImage || (isBrandIt && !toolState.mainFile)) {
            originalWidth = 1024; // Base for aspect ratio calculation
            originalHeight = 1024;
        }

        const outputDimensions = getFinalDimensions(originalWidth, originalHeight, toolState.selectedAspectRatio);
        toolState.outputDimensions = outputDimensions; // Store for result view

        const generateButton = document.getElementById('generate-button');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (generateButton) generateButton.classList.add('hidden');
        if (progressContainer) progressContainer.classList.remove('hidden');
        
        let progress = 0;
        clearInterval(progressInterval);
        progressInterval = setInterval(() => { progress = Math.min(progress + 5, 95); progressBar.style.width = `${progress}%`; progressText.textContent = `${progress}%`; }, 500);
        try {
            let endpoint;
            let body = { prompt: toolState.engineeredPrompt, width: outputDimensions.width, height: outputDimensions.height };

            if (isTextToImage) {
                endpoint = '/api/series';
            } else if (isBrandIt) {
                endpoint = '/api/brand';
                const base64Logo = await fileToBase64(toolState.logoFile);
                body = { ...body, logoImage: base64Logo, logoImageName: toolState.logoFile.name, logoImageType: toolState.logoFile.type };
                if (toolState.mainFile) {
                    const compressedMainFile = await compressImage(toolState.mainFile);
                    const base64MainImage = await fileToBase64(compressedMainFile);
                    body = { ...body, mainImage: base64MainImage, mainImageName: compressedMainFile.name, mainImageType: compressedMainFile.type };
                }
            }
             else {
                endpoint = '/api/edit';
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
                else if (data.edited_image_url) { toolState.resultUrl = data.edited_image_url; }
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
            'removal-tool': { title: 'Removal Tool', subtitle: 'Precisely remove unwanted elements from your images.' },
            'artify': { title: 'Artify', subtitle: 'Transform your images with a touch of artistic flair.' },
            'image-series': { title: 'Image Series', subtitle: 'Generate a sequence of images from a single prompt.' },
            'brand-it': { title: 'Brand It!', subtitle: 'Integrate your logo into any image or scene.' }
        };
        let header = headers[state.activeTool];
        let viewContent = '';

        // --- Tool Landing Pages (Select Mode) ---
        if (toolState.view === 'select-mode') {
            let toolCardsHTML = '';
            if (state.activeTool === 'removal-tool') {
                toolCardsHTML = `
                    <div class="style-grid-lg">
                        <div class="tool-card" data-subtool="background">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            <h3>Remove Background</h3>
                            <p class="text-sm text-secondary">Isolate your subject with a transparent background.</p>
                        </div>
                        <div class="tool-card" data-subtool="object">
                             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 2.012 3 3L16.012 8l-3-3z"/><path d="M7.71 18.29a1 1 0 0 0-.31 1.15l-.29.58a1 1 0 0 0 1.15.31l.58-.29a1 1 0 0 0 .31-1.15z"/><path d="M12.92 2.38a2 2 0 0 0-2.83 0l-7.79 7.79a2 2 0 0 0 0 2.83l7.79 7.79a2 2 0 0 0 2.83 0L20.62 12.08a2 2 0 0 0 0-2.83z"/></svg>
                            <h3>Prompt Removal</h3>
                            <p class="text-sm text-secondary">Describe and remove specific objects with AI magic.</p>
                        </div>
                        <div class="tool-card" data-subtool="watermark">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 12-4 4-4-4"/><path d="M5 20h14"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M6 4H4a2 2 0 0 0-2 2v2"/><path d="M12 12V4"/></svg>
                            <h3>Remove Watermark</h3>
                            <p class="text-sm text-secondary">Clean up unwanted text, logos, or watermarks.</p>
                        </div>
                    </div>
                `;
            } else if (state.activeTool === 'artify') {
                const styles = { 'Master Artists': [ { name: 'Van Gogh', prompt: 'in the style of Van Gogh, expressive impasto brushstrokes', icon: '🎨' }, { name: 'Monet', prompt: 'in the style of Monet, impressionism, soft light', icon: '🌅' }, { name: 'Picasso', prompt: 'in the cubist style of Picasso, abstract, geometric', icon: '🖼️' } ], 'Digital & Retro': [ { name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic city, cinematic lighting', icon: '🌃' }, { name: 'Pixel Art', prompt: '16-bit pixel art style', icon: '👾' }, { name: 'Voxel Art', prompt: 'voxel art, isometric, blocky, 3d pixels', icon: '🧊' } ], 'Handcrafted & Physical': [ { name: 'LEGO', prompt: 'as a LEGO diorama, plastic brick texture', icon: '��' }, { name: 'Pencil Sketch', prompt: 'pencil sketch, hand-drawn, monochrome', icon: '✏️' }, { name: 'Claymation', prompt: 'claymation style, plasticine, stop-motion look', icon: '🗿' } ] };
                toolCardsHTML = Object.entries(styles).map(([category, styleList]) => `
                    <div class="mb-6">
                        <h3 class="style-category-title text-xl font-bold mb-3">${category}</h3>
                        <div class="style-grid">
                            ${styleList.map(s => `
                                <div class="style-btn ${toolState.selectedStyle === s.prompt ? 'active' : ''}" data-style-prompt="${s.prompt}">
                                    <span>${s.icon} ${s.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('');
            }
            viewContent = `<section>${toolCardsHTML}</section>`;
            header.subtitle = (state.activeTool === 'removal-tool') ? 'Select a removal option:' : 'Choose your artistic style:';

        } else if (toolState.view === 'upload' && state.activeTool !== 'brand-it') {
            viewContent = `<section><input type="file" id="image-input" class="hidden" accept="image/*" /><div id="dropzone" class="dropzone rounded-lg p-10 text-center cursor-pointer"><svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg><p class="mt-4 text-lg font-medium">Click to upload or drag & drop</p><p class="text-sm text-secondary mt-1">PNG, JPG, or WEBP. Max 8MB.</p></div></section>`;
        }
        // --- BRAND IT! Specific Upload View ---
        else if (toolState.view === 'upload' && state.activeTool === 'brand-it') {
            viewContent = `
                <section class="space-y-6">
                    <div>
                        <label class="block text-sm font-bold mb-2">Upload Main Image (Optional):</label>
                        <input type="file" id="main-image-input" class="hidden" accept="image/*" />
                        <div id="main-image-dropzone" class="dropzone rounded-lg p-6 text-center cursor-pointer">
                            <svg class="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg>
                            <p class="mt-2 text-md font-medium">Click to upload or drag & drop</p>
                            ${toolState.mainFile ? `<p class="text-xs text-secondary mt-1">Uploaded: ${toolState.mainFile.name}</p>` : ''}
                        </div>
                         ${toolState.mainFile ? `<div class="mt-4" id="main-image-preview-container"><img id="main-image-preview" src="${URL.createObjectURL(toolState.mainFile)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>` : ''}
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-2">Upload Brand Logo (Required):</label>
                        <input type="file" id="logo-image-input" class="hidden" accept="image/*" />
                        <div id="logo-image-dropzone" class="dropzone rounded-lg p-6 text-center cursor-pointer">
                            <svg class="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-20a4 4 0 014 4v20a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h4l2-4h8l2 4h4z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="24" cy="24" r="4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></circle></svg>
                            <p class="mt-2 text-md font-medium">Click to upload or drag & drop</p>
                            ${toolState.logoFile ? `<p class="text-xs text-secondary mt-1">Uploaded: ${toolState.logoFile.name}</p>` : ''}
                        </div>
                        ${toolState.logoFile ? `<div class="mt-4" id="logo-image-preview-container"><img id="logo-image-preview" src="${URL.createObjectURL(toolState.logoFile)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>` : ''}
                    </div>
                    <button id="next-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center">Next</button>
                </section>
            `;
        }
        // --- Edit View for all tools ---
        else if (toolState.view === 'edit') {
            let editControls = '';
            let aspectRatioControls = '';

            const aspectRatios = [
                { name: 'Original', value: 'original' },
                { name: 'Square', value: '1:1' },
                { name: 'Portrait (3:4)', value: '3:4' },
                { name: 'Landscape (4:3)', value: '4:3' },
                { name: 'Portrait (9:16)', value: '9:16' },
                { name: 'Widescreen (16:9)', value: '16:9' }
            ];
            aspectRatioControls = `
                <div class="mb-4">
                    <label class="block text-sm font-bold mb-2">Output Aspect Ratio:</label>
                    <div class="style-grid style-grid-aspect-ratio">
                        ${aspectRatios.map(ar => `
                            <div class="style-btn ${toolState.selectedAspectRatio === ar.value ? 'active' : ''}" data-aspect-ratio="${ar.value}">
                                <span>${ar.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            
            if (state.activeTool === 'prompt-edit') { editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe your edit:</label><textarea id="prompt-input" rows="3" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., add sunglasses to the corgi">${toolState.userInput || ''}</textarea></div>`; }
            else if (state.activeTool === 'removal-tool') {
                let objectInputHidden = (toolState.mode === 'object' ? '' : 'hidden');
                editControls = `
                    <div class="my-4 space-y-2">
                        <input type="hidden" id="removal-mode-input" value="${toolState.mode}">
                        <div id="object-input-container" class="${objectInputHidden}">
                            <label for="object-input" class="block text-sm font-bold mb-2 mt-4">Object to remove:</label>
                            <input type="text" id="object-input" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., the cat on the right" value="${toolState.objectToRemove || ''}">
                        </div>
                    </div>`;
            }
            else if (state.activeTool === 'artify') {
                 editControls = `
                    <div class="my-4">
                        <label class="block text-sm font-bold mb-2">Selected Style:</label>
                        <div class="style-btn active"><span>${toolState.selectedSubTool}</span></div>
                        <input type="hidden" id="artify-style-input" value="${toolState.selectedStyle}">
                    </div>
                `;
            } else if (state.activeTool === 'image-series') {
                 editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe the series of images you want to create:</label><textarea id="prompt-input" rows="5" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., a set of 4 icons for a weather app in a minimalist style">${toolState.userInput || ''}</textarea></div>`;
            }
            else if (state.activeTool === 'brand-it') {
                editControls = `<div><label for="prompt-input" class="block text-sm font-bold mb-2">Describe your scene and how your logo should appear:</label><textarea id="prompt-input" rows="5" class="w-full p-2 border border-primary rounded-md bg-transparent" placeholder="e.g., Generate a black coffee mug and apply the logo to its side, looking like a metallic decal." value="${toolState.userInput || ''}"></textarea></div>`;
            }

            let imagePreviewsHTML = '';
            if (state.activeTool === 'brand-it') {
                imagePreviewsHTML = `
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        ${toolState.mainFile ? `
                            <div>
                                <label class="block text-sm font-bold mb-2">Main Image:</label>
                                <div class="result-image-container"><img id="main-image-preview-edit" src="${URL.createObjectURL(toolState.mainFile)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>
                            </div>
                        ` : ''}
                        <div>
                            <label class="block text-sm font-bold mb-2">${toolState.mainFile ? 'Logo Image:' : 'Logo:'}</label>
                            <div class="result-image-container"><img id="logo-image-preview-edit" src="${URL.createObjectURL(toolState.logoFile)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>
                        </div>
                    </div>
                `;
            } else if (state.activeTool !== 'image-series') {
                imagePreviewsHTML = `<div class="mb-4" id="image-preview-container"><img id="image-preview" src="${URL.createObjectURL(toolState.file)}" class="rounded-lg w-full object-contain border border-primary p-1"></div>`;
            }

            viewContent = `<section>${imagePreviewsHTML}${aspectRatioControls}${editControls}<div class="mt-4 flex space-x-2"><button id="generate-button" class="btn-primary w-full py-2.5 rounded-md flex items-center justify-center"><span>Generate</span></button><button id="reset-button" class="bg-gray-200 dark:bg-gray-700 text-primary px-4 rounded-md font-semibold">Reset</button></div><div id="progress-container" class="mt-4 hidden"><div id="progress-bar" style="width: 0%;"></div><div id="progress-text">0%</div></div></section>`;
        } else if (toolState.view === 'result') {
            let resultHTML = '';
            if (state.activeTool === 'image-series') { resultHTML = `<div class="style-grid">${toolState.resultUrls.map(url => `<div class="result-image-container"><img src="${url}"></div>`).join('')}</div>`; }
            else if (state.activeTool === 'brand-it') {
                resultHTML = `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        ${toolState.mainFile ? `
                            <div>
                                <label class="block text-sm font-bold text-secondary mb-2">Original Image</label>
                                <div class="result-image-container"><img src="${URL.createObjectURL(toolState.mainFile)}"></div>
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-secondary mb-2">Branded Image</label>
                                <div class="result-image-container"><img src="${toolState.resultUrl}"></div>
                            </div>
                        ` : `
                            <div>
                                <label class="block text-sm font-bold text-secondary mb-2">Branded Scene</label>
                                <div class="result-image-container"><img src="${toolState.resultUrl}"></div>
                            </div>
                        `}
                         <div>
                            <label class="block text-sm font-bold text-secondary mb-2">Logo</label>
                            <div class="result-image-container"><img src="${URL.createObjectURL(toolState.logoFile)}"></div>
                        </div>
                    </div>
                `;
            }
            else { resultHTML = `<div><label class="block text-sm font-bold text-secondary mb-2">Original</label><div class="result-image-container"><img src="${URL.createObjectURL(toolState.file)}"></div></div><div><label class="block text-sm font-bold text-secondary mb-2">Edited</label><div class="result-image-container"><img src="${toolState.resultUrl}"></div></div>`; }
            const downloadButtonHTML = state.activeTool !== 'image-series' ? `<button id="download-button" class="btn-secondary w-full py-2.5 rounded-md text-center cursor-pointer">Download</button>` : `<div class="text-sm text-secondary text-center">Right-click on an image to save.</div>`;
            viewContent = `<section class="space-y-4"><div><h3 class="text-lg font-bold mb-1 text-center">Your masterpiece is ready!</h3><p class="text-center text-sm text-secondary italic break-words">Prompt: "${toolState.userInput}"</p></div>${resultHTML}<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">${downloadButtonHTML}<button id="new-edit-button" class="bg-gray-200 dark:bg-gray-700 text-primary w-full py-2.5 rounded-md font-bold">New Edit</button></div></section>`;
        }
        contentContainer.innerHTML = `<header class="tool-header"><h2 class="text-3xl font-bold">${header.title}</h2><p class="text-lg text-secondary">${header.subtitle}</p></header><div class="main-container p-6">${viewContent}</div>`;
        addEventListeners();
        if (toolState.view === 'result' && toolState.outputDimensions) {
            const resultContainers = contentContainer.querySelectorAll('.result-image-container');
            resultContainers.forEach(c => { c.style.aspectRatio = `${toolState.outputDimensions.width} / ${toolState.outputDimensions.height}`; });
        }
    };
    function addEventListeners() {
        const toolState = state[state.activeTool];

        // --- Common Upload Dropzones (for prompt-edit, removal-tool, artify) ---
        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            const imageInput = document.getElementById('image-input');
            dropzone.addEventListener('click', () => imageInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
            imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
        }

        // --- Brand It! Specific Upload Dropzones ---
        const mainImageDropzone = document.getElementById('main-image-dropzone');
        if (mainImageDropzone) {
            const mainImageInput = document.getElementById('main-image-input');
            mainImageDropzone.addEventListener('click', () => mainImageInput.click());
            mainImageDropzone.addEventListener('dragover', (e) => { e.preventDefault(); mainImageDropzone.classList.add('dragover'); });
            mainImageDropzone.addEventListener('dragleave', () => mainImageDropzone.classList.remove('dragover'));
            mainImageDropzone.addEventListener('drop', (e) => { e.preventDefault(); mainImageDropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelectMain(e.dataTransfer.files[0]); });
            mainImageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelectMain(e.target.files[0]); });
        }

        const logoImageDropzone = document.getElementById('logo-image-dropzone');
        if (logoImageDropzone) {
            const logoImageInput = document.getElementById('logo-image-input');
            logoImageDropzone.addEventListener('click', () => logoImageInput.click());
            logoImageDropzone.addEventListener('dragover', (e) => { e.preventDefault(); logoImageDropzone.classList.add('dragover'); });
            logoImageDropzone.addEventListener('dragleave', () => logoImageDropzone.classList.remove('dragover'));
            logoImageDropzone.addEventListener('drop', (e) => { e.preventDefault(); logoImageDropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelectLogo(e.dataTransfer.files[0]); });
            logoImageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelectLogo(e.target.files[0]); });
        }

        const nextButton = document.getElementById('next-button');
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                if (!toolState.logoFile) { alert('Please upload your brand logo to proceed.'); return; }
                toolState.view = 'edit';
                render();
            });
        }


        const generateButton = document.getElementById('generate-button');
        if(generateButton) { generateButton.addEventListener('click', () => {
                if (state.activeTool === 'prompt-edit' || state.activeTool === 'image-series' || state.activeTool === 'brand-it') {
                    toolState.userInput = document.getElementById('prompt-input').value;
                } else if (state.activeTool === 'removal-tool') {
                    toolState.mode = document.getElementById('removal-mode-input').value; // Use hidden input
                    if (toolState.mode === 'object') { toolState.objectToRemove = document.getElementById('object-input').value; }
                } else if (state.activeTool === 'artify') {
                    toolState.selectedStyle = document.getElementById('artify-style-input').value; // Use hidden input
                    // userInput for artify is set in createEngineeredPrompt
                    const activeBtnSpan = document.querySelector('.style-btn.active span');
                    if(activeBtnSpan) toolState.userInput = `Artify with ${activeBtnSpan.textContent.replace(/[\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim()} style`; // Clean emoji
                }
                generateImage();
        });}
        
        const resetButton = document.getElementById('reset-button');
        if(resetButton) resetButton.addEventListener('click', () => { 
            if (state.activeTool === 'brand-it') {
                toolState.mainFile = null;
                toolState.logoFile = null;
                toolState.userInput = '';
                toolState.view = 'upload';
            } else if (state.activeTool === 'removal-tool' || state.activeTool === 'artify') {
                toolState.file = null;
                toolState.userInput = '';
                toolState.selectedStyle = null; // Clear selected style for artify
                toolState.mode = 'background'; // Reset mode for removal
                toolState.view = 'select-mode'; // Go back to select mode
            } else {
                toolState.file = null; 
                toolState.userInput = ''; 
                toolState.view = 'upload'; 
            }
            toolState.selectedAspectRatio = 'original';
            render(); 
        });

        // --- Removal Tool Mode Selection ---
        const removalToolCards = document.querySelectorAll('.tool-card[data-subtool]');
        if (removalToolCards.length > 0) {
            removalToolCards.forEach(card => {
                card.addEventListener('click', () => {
                    toolState.selectedSubTool = card.dataset.subtool;
                    toolState.mode = card.dataset.subtool; // Set the mode in state
                    toolState.view = 'upload'; // Go to upload after mode selected
                    render();
                });
            });
        }

        // --- Artify Style Selection ---
        const artifyStyleBtns = document.querySelectorAll('.style-grid .style-btn');
        if (artifyStyleBtns.length > 0) {
            artifyStyleBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Update the active state visually
                    artifyStyleBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    toolState.selectedStyle = btn.dataset.stylePrompt;
                    toolState.selectedSubTool = btn.querySelector('span').textContent.replace(/[\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim(); // Store display name
                    toolState.view = 'upload'; // Go to upload after style selected
                    render();
                });
            });
        }

        // --- Aspect Ratio Selection ---
        const aspectRatioBtns = document.querySelectorAll('.style-grid-aspect-ratio .style-btn');
        if (aspectRatioBtns.length > 0) {
            aspectRatioBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    aspectRatioBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    toolState.selectedAspectRatio = btn.dataset.aspectRatio;
                });
            });
        }

        const newEditButton = document.getElementById('new-edit-button');
        if(newEditButton) newEditButton.addEventListener('click', () => { 
            if (state.activeTool === 'removal-tool' || state.activeTool === 'artify') {
                toolState.view = 'edit'; // Stay on edit view for re-edits
            } else if (state.activeTool === 'brand-it') {
                 toolState.view = toolState.logoFile ? 'edit' : 'upload';
            }
            else {
                toolState.view = toolState.file ? 'edit' : 'upload';
            }
            render(); 
        });

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

    // --- File Handling ---
    const handleFileSelect = (file) => { // For single image tools
        const toolState = state[state.activeTool];
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
        toolState.file = file;
        const img = new Image();
        img.onload = () => { toolState.dimensions = { width: img.naturalWidth, height: img.naturalHeight }; toolState.view = 'edit'; render(); };
        img.src = URL.createObjectURL(file);
    };

    const handleFileSelectMain = (file) => { // For Brand It! Main Image
        const toolState = state[state.activeTool];
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file for the main image.'); return; }
        toolState.mainFile = file;
        const img = new Image();
        img.onload = () => { toolState.dimensions = { width: img.naturalWidth, height: img.naturalHeight }; render(); };
        img.src = URL.createObjectURL(file);
    };

    const handleFileSelectLogo = (file) => { // For Brand It! Logo Image
        const toolState = state[state.activeTool];
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file for the logo.'); return; }
        toolState.logoFile = file;
        render(); // Rerender to show logo preview
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    
    // Compression logic to ensure image is within reasonable size before sending
    const compressImage = (file) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas'); let { width, height } = img; const maxDim = 1920; // Compress input to 1920px max dimension
            if (width > maxDim || height > maxDim) {
                const aspectRatio = width / height;
                if (width > height) { width = maxDim; height = maxDim / aspectRatio; } else { height = maxDim; width = maxDim * aspectRatio; }
            }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => { URL.revokeObjectURL(img.src); resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); }, 'image/jpeg', 0.9); // Use 0.9 quality
        };
        img.onerror = reject;
    });

    // Initial render call
    render();
});
