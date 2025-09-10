import { fal } from '@fal-ai/client';

fal.config({
  credentials: process.env.FAL_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, please use POST' });
  }

  try {
    // We no longer need width and height, the model infers it from the image
    const { image, imageName, imageType, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({
        error: 'Bad request: Missing image or prompt'
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

    // --- THIS IS THE FIX ---
    // The `width` and `height` parameters were causing conflicts with image-to-image tasks.
    // Removing them allows the model to correctly use the uploaded image's dimensions.
    const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: {
        prompt: prompt,
        image_urls: [imageUrl],
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
