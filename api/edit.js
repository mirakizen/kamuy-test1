import { fal } from '@fal-ai/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, imageName, imageType, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ 
        error: 'Missing image or prompt' 
      });
    }

    // Configure fal client
    fal.config({
      credentials: process.env.FAL_KEY
    });

    // Convert Base64 to a Blob and then a File
    const byteString = atob(image);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: imageType });
    const file = new File([blob], imageName, { type: imageType });

    // Upload image to fal storage
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
    bodyParser: true // Vercel will parse JSON for us
  }
};
