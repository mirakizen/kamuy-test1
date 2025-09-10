document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation Elements ---
    const navLinks = document.querySelectorAll('.nav-link');
    const toolSections = document.querySelectorAll('.tool-section');

    // --- Core App Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const uploadView = document.getElementById('prompt-edit-upload-view');
    const editView = document.getElementById('prompt-edit-edit-view');
    const resultView = document.getElementById('prompt-edit-result-view');
    const imageInput = document.getElementById('image-input');
    const dropzone = document.getElementById('dropzone');
    const imagePreview = document.getElementById('image-preview');
    const promptInput = document.getElementById('prompt-input');
    const generateButton = document.getElementById('generate-button');
    const generateButtonText = document.getElementById('generate-button-text');
    const generateLoader = document.getElementById('generate-loader');
    const resetButton = document.getElementById('reset-button');
    const newEditButton = document.getElementById('new-edit-button');
    const downloadButton = document.getElementById('download-button');
    const beforeImageResult = document.getElementById('before-image-result');
    const afterImageResult = document.getElementById('after-image-result');
    const resultPrompt = document.getElementById('result-prompt');
    
    let originalFile = null, currentPrompt = '';
    let originalDimensions = { width: 0, height: 0 };
    
    // --- Navigation Logic ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tool = link.dataset.tool;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            toolSections.forEach(section => {
                section.style.display = 'none'; // Use style.display for direct manipulation
            });

            const activeSection = document.getElementById(tool);
            if (activeSection) {
                activeSection.style.display = 'block';
            }
        });
    });

    // --- Dark Mode Logic ---
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;

    const applyTheme = (theme) => { document.documentElement.classList.toggle('dark', theme === 'dark'); themeToggle.innerHTML = theme === 'dark' ? sunIcon : moonIcon; };
    themeToggle.addEventListener('click', () => { const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    applyTheme(localStorage.getItem('theme') || 'light');

    // --- App Logic ---
    const showView = (view) => { uploadView.classList.add('hidden'); editView.classList.add('hidden'); resultView.classList.add('hidden'); view.classList.remove('hidden'); };
    const resetToUpload = () => { originalFile = null; originalDimensions = { width: 0, height: 0 }; imageInput.value = ''; promptInput.value = ''; showView(uploadView); };
    const setLoadingState = (isLoading) => { generateButton.disabled = isLoading; generateLoader.classList.toggle('hidden', !isLoading); generateButtonText.textContent = isLoading ? 'Generating...' : 'Generate'; };

    const handleFileSelect = (file) => {
        if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file.'); return; }
        originalFile = file;
        const fileUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            originalDimensions = { width: img.naturalWidth, height: img.naturalHeight };
            imagePreview.src = fileUrl;
            beforeImageResult.src = fileUrl;
            showView(editView);
        };
        img.src = fileUrl;
    };

    dropzone.addEventListener('click', () => imageInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]); });
    imageInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
    
    resetButton.addEventListener('click', resetToUpload);
    newEditButton.addEventListener('click', resetToUpload);

    generateButton.addEventListener('click', async () => {
        currentPrompt = promptInput.value.trim();
        if (!currentPrompt) { alert('Please describe your edit.'); return; }
        setLoadingState(true);
        try {
            const compressedFile = await compressImage(originalFile);
            const base64Image = await fileToBase64(compressedFile);
            const response = await fetch('/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, imageName: compressedFile.name, imageType: compressedFile.type, prompt: currentPrompt, width: originalDimensions.width, height: originalDimensions.height }),
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'The server returned an error.'); }
            const data = await response.json();
            if (data.edited_image_url) {
                afterImageResult.src = data.edited_image_url;
                resultPrompt.textContent = `Prompt: "${currentPrompt}"`;
                showView(resultView);
            } else { throw new Error('Could not find the edited image in the response.'); }
        } catch (error) { console.error('Generation failed:', error); alert(`Error: ${error.message}`);
        } finally { setLoadingState(false); }
    });
    
    downloadButton.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(afterImageResult.src);
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
});
