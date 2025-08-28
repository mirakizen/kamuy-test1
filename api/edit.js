export default async function handler(request) {
  console.log("API route called");

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

    console.log("Calling fal.ai..."); // Debug

    const falFormData = new FormData();
    falFormData.append('image', image);
    falFormData.append('prompt', prompt);

    const response = await fetch('https://api.fal.ai/v1/run/Qwen/Qwen-Image-Edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`
      },
      body: falFormData
    });

    console.log("fal.ai response status:", response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error("fal.ai error:", data);
      return new Response(JSON.stringify({ error: data.error || 'fal.ai request failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ edited_image_url: data.images[0].url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Server error:", error);
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
