import { fal } from '@fal-ai/client';

fal.config({
  credentials: process.env.FAL_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, please use POST' });
  }

  try {
    const { image, imageName, imageType, prompt, width, height, mask } = req.body;

    if (!image || !prompt || !width || !height) {
      return res.status(400).json({ error: 'Bad request: Missing required parameters' });
    }

    const file = await bufferFromBase64(image, imageName, imageType);
    const imageUrl = await fal.storage.upload(file);
    
    let maskUrl = null;
    if (mask) {
        const maskFile = await bufferFromBase64(mask, 'mask.png', 'image/png');
        maskUrl = await fal.storage.upload(maskFile);
    }

    const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: {
        prompt: prompt,
        image_urls: [imageUrl],
        mask_url: maskUrl, // Will be null if no mask is provided, which is fine
        width: width,
        height: height,
      },
      logs: true,
    });

    if (result?.data?.images?.[0]?.url) {
      return res.status(200).json({ edited_image_url: result.data.images[0].url });
    } else {
      console.error('Fal.ai response did not contain an image URL:', result);
      return res.status(500).json({ error: 'Image generation failed. Please check the server logs.' });
    }

  } catch (error) {
    console.error('Server-side error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred: ' + error.message });
  }
}

async function bufferFromBase64(base64, name, type) {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: type });
    return new File([blob], name, { type: type });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
