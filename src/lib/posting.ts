import { Post } from '@prisma/client';

export async function postToDiscord(post: Post): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL is not set. Cannot post to Discord.");
    // In a real app, you might throw an error or handle this more gracefully.
    return;
  }

  // Discord webhooks have a specific JSON structure (payload)
  const payload = {
    content: "🚀 New post approved!", // A simple header message
    embeds: [
      {
        title: "Post Content",
        description: post.caption,
        color: 5814783, // A nice hex color for the embed's side bar
        image: {
          url: post.imageUrl,
        },
        footer: {
          text: `Post ID: ${post.id}`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // If Discord returns an error, log it for debugging
      const errorBody = await response.text();
      console.error(`Error posting to Discord: ${response.status} ${response.statusText}`, errorBody);
    } else {
      console.log(`Successfully posted Post ID ${post.id} to Discord.`);
    }
  } catch (error) {
    console.error("Failed to send request to Discord webhook:", error);
  }
}
