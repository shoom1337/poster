/**
 * Telegram publish service - sending posts to Telegram channels
 */

import { Bot } from 'grammy';
import { logger } from '../utils/logger.js';
import { getPostById, updatePost } from './postService.js';
import { PostStatus } from '@prisma/client';
import { prisma } from '../utils/db.js';

/**
 * Publish post to Telegram channel
 */
export async function publishPostToTelegram(bot: Bot, postId: number): Promise<boolean> {
  try {
    const post = await getPostById(postId);

    if (!post) {
      logger.error('Post not found for publishing', { postId });
      return false;
    }

    if (!post.channel) {
      logger.error('Channel not found for post', { postId });
      return false;
    }

    const channelId = post.channel.channel_id.toString();

    logger.info('Publishing post to Telegram', {
      postId,
      channelId,
      channelIdType: typeof channelId,
      hasMedia: post.media.length > 0,
      mediaCount: post.media.length,
      hasButtons: post.buttons.length > 0,
      textLength: post.text.length,
    });

    // Build inline keyboard if there are buttons
    let replyMarkup: any = undefined;
    if (post.buttons.length > 0) {
      const { InlineKeyboard } = await import('grammy');
      const keyboard = new InlineKeyboard();

      // Group buttons by row
      const buttonsByRow = new Map<number, typeof post.buttons>();
      post.buttons.forEach(button => {
        if (!buttonsByRow.has(button.row)) {
          buttonsByRow.set(button.row, []);
        }
        buttonsByRow.get(button.row)!.push(button);
      });

      // Add buttons row by row
      Array.from(buttonsByRow.keys()).sort().forEach(row => {
        const rowButtons = buttonsByRow.get(row)!.sort((a, b) => a.position - b.position);
        rowButtons.forEach(button => {
          keyboard.url(button.text, button.url);
        });
        keyboard.row();
      });

      replyMarkup = keyboard;
    }

    let messageId: bigint;

    // Send based on media count
    if (post.media.length === 0) {
      // Text only
      logger.debug('Sending text-only message', { channelId, textLength: post.text.length });
      const sentMessage = await bot.api.sendMessage(channelId, post.text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
      messageId = BigInt(sentMessage.message_id);
      logger.debug('Text message sent', { messageId: messageId.toString() });

    } else if (post.media.length === 1) {
      // Single media
      const media = post.media[0];
      const caption = media.caption || post.text;

      logger.debug('Sending single media', {
        channelId,
        fileType: media.file_type,
        fileId: media.file_id,
        captionLength: caption.length,
      });

      switch (media.file_type) {
        case 'PHOTO':
          const photoMsg = await bot.api.sendPhoto(channelId, media.file_id, {
            caption,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
          messageId = BigInt(photoMsg.message_id);
          logger.debug('Photo sent', { messageId: messageId.toString() });
          break;

        case 'VIDEO':
          const videoMsg = await bot.api.sendVideo(channelId, media.file_id, {
            caption,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
          messageId = BigInt(videoMsg.message_id);
          break;

        case 'DOCUMENT':
          const docMsg = await bot.api.sendDocument(channelId, media.file_id, {
            caption,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
          messageId = BigInt(docMsg.message_id);
          break;

        case 'ANIMATION':
          const animMsg = await bot.api.sendAnimation(channelId, media.file_id, {
            caption,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
          messageId = BigInt(animMsg.message_id);
          break;

        default:
          logger.error('Unknown media type', { mediaType: media.file_type });
          return false;
      }

    } else {
      // Media group (2-10 items)
      const { InputMediaBuilder } = await import('grammy');
      const mediaGroup: any[] = [];

      post.media.forEach((media, index) => {
        const caption = index === 0 ? post.text : (media.caption || undefined);

        switch (media.file_type) {
          case 'PHOTO':
            mediaGroup.push(
              InputMediaBuilder.photo(media.file_id, {
                caption,
                parse_mode: 'HTML',
              })
            );
            break;

          case 'VIDEO':
            mediaGroup.push(
              InputMediaBuilder.video(media.file_id, {
                caption,
                parse_mode: 'HTML',
              })
            );
            break;

          case 'DOCUMENT':
            mediaGroup.push(
              InputMediaBuilder.document(media.file_id, {
                caption,
                parse_mode: 'HTML',
              })
            );
            break;

          case 'ANIMATION':
            // Note: animations can't be in media groups, treat as document
            mediaGroup.push(
              InputMediaBuilder.document(media.file_id, {
                caption,
                parse_mode: 'HTML',
              })
            );
            break;
        }
      });

      const sentMessages = await bot.api.sendMediaGroup(channelId, mediaGroup);
      messageId = BigInt(sentMessages[0].message_id);

      // If there are buttons, send them in a separate message
      if (replyMarkup) {
        await bot.api.sendMessage(channelId, '⬆️', {
          reply_markup: replyMarkup,
        });
      }
    }

    // Update post with message ID and published status
    await updatePost(postId, {
      status: PostStatus.PUBLISHED,
    });

    await prisma.post.update({
      where: { id: postId },
      data: {
        telegram_message_id: messageId,
        published_at: new Date(),
      },
    });

    logger.info('Post published successfully', {
      postId,
      messageId: messageId.toString(),
    });

    return true;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Failed to publish post to Telegram', {
      error: errorMessage,
      stack: errorStack,
      postId,
      errorDetails: error,
    });

    // Update post status to FAILED
    try {
      await updatePost(postId, {
        status: PostStatus.FAILED,
      });
    } catch (updateError) {
      logger.error('Failed to update post status to FAILED', {
        updateError,
        postId,
      });
    }

    return false;
  }
}

/**
 * Delete post from Telegram channel
 */
export async function deletePostFromTelegram(bot: Bot, postId: number): Promise<boolean> {
  try {
    const post = await getPostById(postId);

    if (!post || !post.telegram_message_id || !post.channel) {
      logger.warn('Cannot delete post from Telegram - missing data', { postId });
      return false;
    }

    const channelId = post.channel.channel_id.toString();
    const messageId = Number(post.telegram_message_id);

    await bot.api.deleteMessage(channelId, messageId);

    logger.info('Post deleted from Telegram', { postId, messageId });

    return true;

  } catch (error) {
    logger.error('Failed to delete post from Telegram', { error, postId });
    return false;
  }
}
