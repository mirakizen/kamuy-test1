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
    const { mainImage, mainImageName, mainImageType, logoImage, logoImageName, logoImageType, prompt, width, height } = req.body;

    if (!logoImage || !prompt || !width || !height) {
      return res.status(400).json({ error: 'Bad request: Missing required parameters (logo, prompt, dimensions)' });
    }

    let image_urls = [];

    // Upload main image if provided
    if (mainImage) {
        const mainFile = await fileFromBase64(mainImage, mainImageName, mainImageType);
        const mainImageUrl = await fal.storage.upload(mainFile);
        image_urls.push(mainImageUrl);
    }

    // Upload logo image (required)
    const logoFile = await fileFromBase64(logoImage, logoImageName, logoImageType);
    const logoImageUrl = await fal.storage.upload(logoFile);
    image_urls.push(logoImageUrl);
    
    // Ensure the prompt guides the AI to use the logo image.
    // We explicitly tell it to use the LAST image URL as the logo.
    const engineeredPrompt = `${prompt}. Use the last image in the image_urls as a logo/brand image to be integrated.`;

    const input = {
        prompt: engineeredPrompt,
        image_urls: image_urls,
        image_size: {
            width: width,
            height: height
        },
        strength: 0.15, // Keep strength low for clean logo integration
        guidance_scale: 7.5,
        num_inference_steps: 40,
        negative_prompt: "blurry, low quality, distorted, deformed, artifacts, text corruption, unreadable text, messy, sloppy, inaccurate details, mutated, malformed, extra limbs, bad anatomy, bad eyes, ugly, disfigured, poor facial details, strange face, duplicate, watermark, signature, logo, irrelevant elements",
    };
    
    // For 'Brand It!', we don't anticipate a mask_url from the current UI.
    // If future iterations add mask painting for logo placement, it can be re-added.

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
