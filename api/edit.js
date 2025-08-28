import { Readable } from 'stream';
import { parse } from 'formidable';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const data = await new Promise((resolve, reject) => {
      const form = parse({
        multiples: false,
        keepExtensions: true
      });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const imageFile = data.files.image;
    const prompt = data.fields.prompt;

    if (!imageFile || !prompt) {
      return res.status(400).json({ 
        error: 'Missing image or prompt' 
      });
    }

    // Read image file
    const imageBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const stream = Readable.from(imageFile);
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    // Upload image to fal storage
    const storageResponse = await fetch('https://api.fal.ai/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`
      },
      body: imageBuffer,
      headers: {
        'Content-Type': imageFile.mimetype
      }
    });

    if (!storageResponse.ok) {
      const error = await storageResponse.json().catch(() => ({}));
      return res.status(500).json({ 
        error: 'Upload failed', 
        details: error 
      });
    }

    const { url: imageUrl } = await storageResponse.json();

    // Call fal.ai qwen-image-edit model
    const falResponse = await fetch('https://api.fal.ai/v1/run/fal-ai/qwen-image-edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          image_url: imageUrl,
          sync_mode: true
        }
      })
    });

    const result = await falResponse.json();

    if (result.data?.images?.[0]?.url) {
      return res.status(200).json({ 
        edited_image_url: result.data.images[0].url 
      });
    } else {
      return res.status(500).json({ 
        error: result.error || 'fal.ai request failed', 
        details: result 
      });
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error: ' + error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
