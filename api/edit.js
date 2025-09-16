import { fal } from '@fal-ai/client';

fal.config({
  credentials: process.env.FAL_KEY,
});

// Helper function to convert base64 to a File object
async function fileFromBase64(base64, name, type) {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: type });
    return new File([blob], name, { type: type });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, please use POST' });
  }

  try {
    const { image, imageName, imageType, prompt, width, height, mask, strength } = req.body;

    if (!image || !prompt || !width || !height) {
      return res.status(400).json({ error: 'Bad request: Missing required parameters' });
    }

    // Upload the main image
    const imageFile = await fileFromBase64(image, imageName, imageType);
    const imageUrl = await fal.storage.upload(imageFile);
    
    // --- Properly handle the mask ---
    let maskUrl = null;
    if (mask) {
        // If a mask is provided, convert and upload it to get a URL
        const maskFile = await fileFromBase64(mask, 'mask.png', 'image/png');
        maskUrl = await fal.storage.upload(maskFile);
    }

    // Construct the input for the AI model with tuned params for better preservation
    const input = {
        prompt: prompt,
        image_urls: [imageUrl],
        width: width,
        height: height,
        strength: strength || 0.2,  // Low strength for subtle edits, preserves original structure/faces/limbs
        guidance_scale: 7.5,  // Balances prompt adherence with image fidelity
        num_inference_steps: 30,  // More steps for finer details without over-processing
        negative_prompt: "distorted faces, deformed limbs, artifacts, mutations, extra limbs, missing limbs, blurry, low quality",  // Explicitly avoid common issues
    };
    
    // Only add mask_url to the input if it exists
    if (maskUrl) {
        input.mask_url = maskUrl;
    }

    const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: input,
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
