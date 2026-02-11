/**
 * Post service - business logic for post management
 */
import { prisma } from '../utils/db.js';
import { Post, PostStatus, Media, MediaType, PostButton, Schedule } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface CreatePostData {
  channelId: number;
  text: string;
  status?: PostStatus;
}

export interface UpdatePostData {
  text?: string;
  status?: PostStatus;
  channelId?: number;
}

/**
 * Create a new post
 */
export async function createPost(data: CreatePostData): Promise<Post> {
  try {
    logger.info('createPost called', {
      channelId: data.channelId,
      channelIdType: typeof data.channelId,
      textLength: data.text?.length,
      status: data.status
    });

    const post = await prisma.post.create({
      data: {
        channel: {
          connect: { id: data.channelId },
        },
        text: data.text,
        status: data.status || PostStatus.DRAFT,
      },
      include: {
        channel: true,
      },
    });

    logger.info('Post created', { postId: post.id, channelId: data.channelId });
    return post;
  } catch (error) {
    logger.error('Failed to create post', { error, data });
    throw new Error('Не удалось создать публикацию');
  }
}

/**
 * Get post by ID with all relations
 */
export async function getPostById(postId: number) {
  try {
    return await prisma.post.findUnique({
      where: { id: postId },
      include: {
        channel: true,
        media: { orderBy: { position: 'asc' } },
        buttons: { orderBy: [{ row: 'asc' }, { position: 'asc' }] },
        schedule: true,
        statistics: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get post', { error, postId });
    return null;
  }
}

/**
 * Update post
 */
export async function updatePost(postId: number, data: UpdatePostData): Promise<Post> {
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data,
    });

    logger.info('Post updated', { postId });
    return post;
  } catch (error) {
    logger.error('Failed to update post', { error, postId, data });
    throw new Error('Не удалось обновить публикацию');
  }
}

/**
 * Delete post
 */
export async function deletePost(postId: number): Promise<void> {
  try {
    await prisma.post.delete({
      where: { id: postId },
    });

    logger.info('Post deleted', { postId });
  } catch (error) {
    logger.error('Failed to delete post', { error, postId });
    throw new Error('Не удалось удалить публикацию');
  }
}

/**
 * Get posts by status
 */
export async function getPostsByStatus(status: PostStatus, limit: number = 10) {
  try {
    return await prisma.post.findMany({
      where: { status },
      include: {
        channel: true,
        schedule: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  } catch (error) {
    logger.error('Failed to get posts by status', { error, status });
    return [];
  }
}

/**
 * Get drafts
 */
export async function getDrafts(limit: number = 10) {
  return getPostsByStatus(PostStatus.DRAFT, limit);
}

/**
 * Add media to post
 */
export async function addMedia(
  postId: number,
  fileId: string,
  fileType: MediaType,
  fileSize?: number,
  caption?: string
): Promise<Media> {
  try {
    // Get current media count for position
    const mediaCount = await prisma.media.count({
      where: { post_id: postId },
    });

    const media = await prisma.media.create({
      data: {
        post_id: postId,
        file_id: fileId,
        file_type: fileType,
        file_size: fileSize,
        caption,
        position: mediaCount,
      },
    });

    logger.info('Media added to post', { postId, mediaId: media.id });
    return media;
  } catch (error) {
    logger.error('Failed to add media', { error, postId });
    throw new Error('Не удалось добавить медиафайл');
  }
}

/**
 * Add button to post
 */
export async function addButton(
  postId: number,
  text: string,
  url: string,
  row: number = 0,
  position: number = 0
): Promise<PostButton> {
  try {
    const button = await prisma.postButton.create({
      data: {
        post_id: postId,
        text,
        url,
        row,
        position,
      },
    });

    logger.info('Button added to post', { postId, buttonId: button.id });
    return button;
  } catch (error) {
    logger.error('Failed to add button', { error, postId });
    throw new Error('Не удалось добавить кнопку');
  }
}

/**
 * Schedule post
 */
export async function schedulePost(postId: number, scheduledAt: Date): Promise<Schedule> {
  try {
    const schedule = await prisma.schedule.create({
      data: {
        post_id: postId,
        scheduled_at: scheduledAt,
      },
    });

    // Update post status
    await updatePost(postId, { status: PostStatus.SCHEDULED });

    logger.info('Post scheduled', { postId, scheduledAt });
    return schedule;
  } catch (error) {
    logger.error('Failed to schedule post', { error, postId });
    throw new Error('Не удалось запланировать публикацию');
  }
}

/**
 * Duplicate post
 */
export async function duplicatePost(postId: number): Promise<Post> {
  try {
    const original = await getPostById(postId);
    if (!original) {
      throw new Error('Публикация не найдена');
    }

    // Create new post
    const duplicate = await prisma.post.create({
      data: {
        channel_id: original.channel_id,
        text: original.text,
        status: PostStatus.DRAFT,
      },
    });

    // Copy media
    for (const media of original.media) {
      await addMedia(
        duplicate.id,
        media.file_id,
        media.file_type,
        media.file_size || undefined,
        media.caption || undefined
      );
    }

    // Copy buttons
    for (const button of original.buttons) {
      await addButton(duplicate.id, button.text, button.url, button.row, button.position);
    }

    logger.info('Post duplicated', { originalId: postId, duplicateId: duplicate.id });
    return duplicate;
  } catch (error) {
    logger.error('Failed to duplicate post', { error, postId });
    throw new Error('Не удалось дублировать публикацию');
  }
}
