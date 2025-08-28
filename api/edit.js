export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const prompt = formData.get('prompt');

    if (!image || !prompt) {
      return new Response(JSON.stringify({ error: 'Missing image or prompt' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: 'Upload failed', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
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
      return new Response(JSON.stringify({ edited_image_url: result.data.images[0].url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        error: result.error || 'fal.ai request failed', 
        details: result 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
