import { fal } from '@fal-ai/client';

fal.config({
  credentials: process.env.FAL_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, please use POST' });
  }

  try {
    // --- THIS IS THE FIX: Receive width and height from the request body ---
    const { image, imageName, imageType, prompt, width, height } = req.body;

    if (!image || !prompt || !width || !height) {
      return res.status(400).json({
        error: 'Bad request: Missing image, prompt, or dimensions'
      });
    }

    const byteString = atob(image);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: imageType });
    const file = new File([blob], imageName, { type: imageType });

    const imageUrl = await fal.storage.upload(file);

    // --- THIS IS THE FIX: Add width and height to the API input ---
    const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: {
        prompt: prompt,
        image_urls: [imageUrl],
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
