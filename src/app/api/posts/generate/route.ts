import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import twilio from 'twilio';

const prisma = new PrismaClient();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId } = body;

    if (!reviewId) {
      return NextResponse.json({ error: 'reviewId is required' }, { status: 400 });
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const prompt = `
      You are a friendly social media manager for a local service business.
      Your task is to write a short, upbeat, and professional social media post based on a positive customer review.
      Follow these rules:
      - Thank the customer by name.
      - Specifically mention one positive detail from their review.
      - Keep the entire post under 50 words.
      - Do NOT use any hashtags.
      - Do NOT ask any questions.
      - Do NOT use emojis.
      Here is the customer review:
      - Author: ${review.authorName}
      - Rating: ${review.rating} out of 5 stars
      - Content: "${review.content}"
    `;

    const dataForSeoLogin = process.env.DATAFORSEO_LOGIN;
    const dataForSeoPassword = process.env.DATAFORSEO_PASSWORD;
    if (!dataForSeoLogin || !dataForSeoPassword) {
      throw new Error('DataForSEO credentials are not set');
    }

    const headers = new Headers();
    headers.append("Authorization", "Basic " + Buffer.from(dataForSeoLogin + ":" + dataForSeoPassword).toString("base64"));
    headers.append("Content-Type", "application/json");

    const apiResponse = await fetch('https://api.dataforseo.com/v3/content_generation/generate/live', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify([{ "prompt": prompt, "creativity_index": 0.7 }]),
    });

    const apiJson = await apiResponse.json();
    const generatedCaption = apiJson?.tasks?.[0]?.result?.[0]?.items?.[0]?.content?.trim();

    if (!generatedCaption) {
      console.error("Content generation failed. API response:", apiJson);
      return NextResponse.json({ error: 'Failed to generate content from API' }, { status: 500 });
    }
    
    const approvalSlug = crypto.randomBytes(6).toString('hex');
    const newPost = await prisma.post.create({
      data: {
        businessId: review.businessId,
        reviewId: review.id,
        caption: generatedCaption,
        imageUrl: 'https://via.placeholder.com/1080x1080.png?text=Post+Image',
        status: 'pending_approval',
        approvalSlug: approvalSlug,
      }
    });
    
    const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const toPhoneNumber = process.env.PERSONAL_PHONE_NUMBER_FOR_TESTING;

    if (twilioClient && fromPhoneNumber && toPhoneNumber) {
      const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const approvalUrl = `${appUrl}/approve/${newPost.approvalSlug}`;

      try {
        const messageBody = `JobsDoneWell: A new post is ready for your approval. Click here: ${approvalUrl}`;
        await twilioClient.messages.create({
          body: messageBody,
          from: fromPhoneNumber,
          to: toPhoneNumber
        });
        console.log(`Successfully sent approval SMS for post ${newPost.id} to ${toPhoneNumber}`);
      } catch (smsError) {
        console.error(`Failed to send SMS for post ${newPost.id}:`, smsError);
      }
    } else {
      console.warn("Twilio is not fully configured. Skipping SMS notification.");
    }

    return NextResponse.json(newPost);

  } catch (error) {
    console.error("An unexpected error occurred in generate endpoint:", error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
