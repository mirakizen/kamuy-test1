export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = await req.formData();
    const image = formData.get('image');
    const prompt = formData.get('prompt');

    if (!image || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }

    // Upload image to fal storage
    const file = new File([image], image.name, { type: image.type });
    const storageResponse = await fetch('https://api.fal.ai/storage/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`
      },
      body: file
    });

    if (!storageResponse.ok) {
      const error = await storageResponse.json().catch(() => ({}));
      return res.status(500).json({ error: 'Upload failed', details: error });
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
      return res.status(200).json({ edited_image_url: result.data.images[0].url });
    } else {
      return res.status(500).json({ 
        error: result.error || 'fal.ai request failed', 
        details: result 
      });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
