import { fal } from '@fal-ai/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data using a method compatible with Vercel
    const formData = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      req.on('error', reject);
    });

    // Extract image and prompt from form data (simplified for demo)
    // In a real app, you'd properly parse multipart/form-data
    const boundary = req.headers['content-type'].split('boundary=')[1];
    const parts = formData.toString().split('--' + boundary);
    
    let imageFile = null;
    let prompt = null;

    for (const part of parts) {
      if (part.includes('name="image"')) {
        const headersEnd = part.indexOf('\r\n\r\n');
        imageFile = part.slice(headersEnd + 4, part.lastIndexOf('\r\n'));
      }
      if (part.includes('name="prompt"')) {
        const headersEnd = part.indexOf('\r\n\r\n');
        prompt = part.slice(headersEnd + 4, part.lastIndexOf('\r\n')).trim();
      }
    }

    if (!imageFile || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }

    // Configure fal client
    fal.config({
      credentials: process.env.FAL_KEY
    });

    // Upload image to fal storage
    const blob = new Blob([imageFile], { type: 'image/jpeg' });
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    const imageUrl = await fal.storage.upload(file);

    // Call the model
    const result = await fal.subscribe('fal-ai/qwen-image-edit', {
      input: {
        prompt: prompt,
        image_url: imageUrl,
        sync_mode: true
      },
      logs: true
    });

    if (result.data?.images?.[0]?.url) {
      return res.status(200).json({ edited_image_url: result.data.images[0].url });
    } else {
      return res.status(500).json({ error: 'fal.ai request failed' });
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
