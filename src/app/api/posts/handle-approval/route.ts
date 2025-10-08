import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { postToDiscord } from '@/lib/posting';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, approved } = body;

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }
    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'approved boolean is required' }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status !== 'pending_approval') {
      return NextResponse.json(
        { message: 'This post has already been handled.', currentStatus: post.status },
        { status: 409 }
      );
    }

    const newStatus = approved ? 'approved' : 'discarded';

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { status: newStatus },
    });

    console.log(`Post ${postId} status updated to ${newStatus}`);

    if (approved) {
      await postToDiscord(updatedPost);
    }

    return NextResponse.json({
      message: `Post successfully ${newStatus}.`,
      post: updatedPost,
    });

  } catch (error) {
    console.error("An unexpected error occurred in handle-approval:", error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
