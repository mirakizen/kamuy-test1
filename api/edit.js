import { fal } from '@fal-ai/client';

// Initialise the fal client with your API key from Vercel environment variables
fal.config({
  credentials: process.env.FAL_KEY,
});

export default async function handler(req, res) {
  // We only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed, please use POST' });
  }

  try {
    const { image, imageName, imageType, prompt } = req.body;

    // Basic validation to ensure we have what we need
    if (!image || !prompt) {
      return res.status(400).json({
        error: 'Bad request: Missing image or prompt'
      });
    }

    // Convert the Base64 image data from the client into a File object
    // that the fal client can understand
    const byteString = atob(image);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: imageType });
    const file = new File([blob], imageName, { type: imageType });

    // Upload the file to fal.ai's temporary storage and get a URL
    const imageUrl = await fal.storage.upload(file);

    // Call the Seedream 4.0 model via the Fal.ai client
    // THIS IS THE FIX: The model requires `image_urls` as an array.
    const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: {
        prompt: prompt,
        image_urls: [imageUrl], // Corrected parameter name and format
      },
      logs: true, // Enable logs for easier debugging on the fal.ai side
    });

    // Check for a valid result and send the edited image URL back to the client
    if (result?.images?.[0]?.url) {
      return res.status(200).json({ edited_image_url: result.images[0].url });
    } else {
      // If the result is not in the expected format, log it and return an error
      console.error('Fal.ai response did not contain an image URL:', result);
      return res.status(500).json({ error: 'Image generation failed. Please check the server logs.' });
    }

  } catch (error) {
    // Catch any errors during the process and return a detailed error message
    console.error('Server-side error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred: ' + error.message });
  }
}

// Vercel-specific config to allow larger request bodies for images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow up to 10MB request bodies
    },
  },
};
