import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OUR_INTERNAL_BUSINESS_ID = "cl_hardcoded_business_1";
const GMB_LOCATION_ID = "0x47e66e2964e34e2d:0x8ddca9ee380ef7e0";

async function ensureBusinessExists() {
  const existingBusiness = await prisma.business.findUnique({
    where: { id: OUR_INTERNAL_BUSINESS_ID },
  });

  if (!existingBusiness) {
    const dummyUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: { email: 'test@example.com' },
    });

    await prisma.business.create({
      data: {
        id: OUR_INTERNAL_BUSINESS_ID,
        name: "Eiffel Tower",
        gmbLocationId: GMB_LOCATION_ID,
        userId: dummyUser.id,
      },
    });
    console.log("Created dummy user and business for testing.");
  }
}

export async function POST() {
  console.log("Review fetch endpoint triggered.");
  
  await ensureBusinessExists();

  const dataForSeoLogin = process.env.DATAFORSEO_LOGIN;
  const dataForSeoPassword = process.env.DATAFORSEO_PASSWORD;

  if (!dataForSeoLogin || !dataForSeoPassword) {
    return NextResponse.json({ error: 'DataForSEO credentials are not set' }, { status: 500 });
  }

  const headers = new Headers();
  headers.append("Authorization", "Basic " + Buffer.from(dataForSeoLogin + ":" + dataForSeoPassword).toString("base64"));
  headers.append("Content-Type", "application/json");

  const postData = [{
    "location_coordinate": `place_id:${GMB_LOCATION_ID}`,
    "language_name": "English",
    "sort_by": "newest",
    "depth": 20
  }];
  
  try {
    console.log("Calling DataForSEO API...");
    const apiResponse = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(postData),
    });

    const apiJson = await apiResponse.json();

    if (apiJson.tasks_error > 0 || !apiJson.tasks?.[0]?.result?.[0]?.items) {
      console.error("DataForSEO API error:", apiJson);
      return NextResponse.json({ error: 'DataForSEO API returned an error or no items' }, { status: 500 });
    }

    const reviewsFromAPI = apiJson.tasks[0].result[0].items;
    let newReviewsCount = 0;
    console.log(`Received ${reviewsFromAPI.length} reviews from API.`);

    for (const review of reviewsFromAPI) {
      if (!review.review_id || !review.review_text || !review.rating?.rating_value) {
        continue;
      }

      const existingReview = await prisma.review.findUnique({
        where: { sourceId: review.review_id },
      });

      if (!existingReview) {
        await prisma.review.create({
          data: {
            businessId: OUR_INTERNAL_BUSINESS_ID,
            sourceId: review.review_id,
            authorName: review.profile_name || 'Anonymous',
            rating: review.rating.rating_value,
            content: review.review_text,
            reviewDate: new Date(review.timestamp),
          },
        });
        newReviewsCount++;
      }
    }
    
    console.log(`Saved ${newReviewsCount} new reviews to the database.`);
    return NextResponse.json({ 
      message: 'Review fetch complete.',
      newReviewsSaved: newReviewsCount,
      totalReviewsChecked: reviewsFromAPI.length 
    });

  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return NextResponse.json({ error: 'Failed to process reviews' }, { status: 500 });
  }
}
