/**
 * Media input handler for post creation/editing
 */

import { Bot, Context } from 'grammy';
import { logger } from '../../utils/logger.js';
import { validateMediaSize, validateMediaGroupSize } from '../../utils/validators.js';
import {
  getAwaitingInput,
  getPostDraft,
  updatePostDraft,
} from '../utils/sessionState.js';
import { buildValidationErrorMessage, buildMediaUploadMessage } from '../utils/messageBuilder.js';
import { SessionMediaFile } from '../../types/session.js';
import { MediaType } from '@prisma/client';

/**
 * Register media input handlers
 */
export function registerMediaInputHandler(bot: Bot) {
  // Handle photo uploads
  bot.on('message:photo', async (ctx) => {
    await handleMediaUpload(ctx, 'photo');
  });

  // Handle video uploads
  bot.on('message:video', async (ctx) => {
    await handleMediaUpload(ctx, 'video');
  });

  // Handle document uploads
  bot.on('message:document', async (ctx) => {
    await handleMediaUpload(ctx, 'document');
  });

  // Handle animation/GIF uploads
  bot.on('message:animation', async (ctx) => {
    await handleMediaUpload(ctx, 'animation');
  });
}

/**
 * Handle media upload
 */
async function handleMediaUpload(
  ctx: Context,
  type: 'photo' | 'video' | 'document' | 'animation'
) {
  const awaitingInput = getAwaitingInput(ctx);

  // Check if we're awaiting media input
  if (awaitingInput?.type !== 'media') {
    return; // Not our message
  }

  const userId = ctx.from?.id;
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.reply('❌ Сессия истекла. Начните создание поста заново с /newpost');
    return;
  }

  try {
    let fileId: string;
    let fileSize: number | undefined;
    let mediaType: MediaType;

    // Extract file info based on type
    if (type === 'photo') {
      const photos = ctx.message?.photo;
      if (!photos || photos.length === 0) return;

      // Get largest photo
      const photo = photos[photos.length - 1];
      fileId = photo.file_id;
      fileSize = photo.file_size;
      mediaType = 'PHOTO';
    } else if (type === 'video') {
      const video = ctx.message?.video;
      if (!video) return;

      fileId = video.file_id;
      fileSize = video.file_size;
      mediaType = 'VIDEO';
    } else if (type === 'document') {
      const document = ctx.message?.document;
      if (!document) return;

      fileId = document.file_id;
      fileSize = document.file_size;
      mediaType = 'DOCUMENT';
    } else {
      // animation
      const animation = ctx.message?.animation;
      if (!animation) return;

      fileId = animation.file_id;
      fileSize = animation.file_size;
      mediaType = 'ANIMATION';
    }

    // Validate file size
    if (fileSize) {
      // Animation is treated as document for size validation
      const validationType = type === 'animation' ? 'document' : type;
      const sizeValidation = validateMediaSize(fileSize, validationType as 'photo' | 'video' | 'document');
      if (!sizeValidation.valid) {
        await ctx.reply(buildValidationErrorMessage(sizeValidation.error!));
        return;
      }
    }

    // Get current media files
    const mediaFiles = draft.mediaFiles || [];

    // Validate media group size
    const groupValidation = validateMediaGroupSize(mediaFiles.length + 1);
    if (!groupValidation.valid) {
      await ctx.reply(buildValidationErrorMessage(groupValidation.error!));
      return;
    }

    // Add new media file
    const newMedia: SessionMediaFile = {
      fileId,
      fileType: mediaType,
      fileSize,
      position: mediaFiles.length,
      caption: ctx.message?.caption,
    };

    mediaFiles.push(newMedia);

    // Update draft
    updatePostDraft(ctx, { mediaFiles });

    logger.info('Media file added', {
      userId,
      fileType: mediaType,
      totalFiles: mediaFiles.length,
    });

    // Send confirmation (no need to clear awaitingInput yet, user can add more files)
    await ctx.reply(buildMediaUploadMessage(mediaFiles.length));
  } catch (error) {
    logger.error('Error handling media upload', { error, userId });
    await ctx.reply('❌ Произошла ошибка при загрузке медиа');
  }
}
