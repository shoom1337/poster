/**
 * Post scheduler service - background job to publish scheduled posts
 */

import { Bot } from 'grammy';
import { prisma } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { publishPostToTelegram } from './telegramPublishService.js';
import { PostStatus } from '@prisma/client';

let schedulerInterval: NodeJS.Timeout | null = null;
let botInstance: Bot | null = null;

/**
 * Start the post scheduler
 * Checks every minute for posts that need to be published
 */
export function startScheduler(bot: Bot) {
  if (schedulerInterval) {
    logger.warn('Scheduler already running');
    return;
  }

  botInstance = bot;

  logger.info('Starting post scheduler');

  // Check immediately on start
  checkAndPublishScheduledPosts();

  // Then check every minute
  schedulerInterval = setInterval(() => {
    checkAndPublishScheduledPosts();
  }, 60 * 1000); // 60 seconds

  logger.info('Post scheduler started - checking every 60 seconds');
}

/**
 * Stop the post scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Post scheduler stopped');
  }
}

/**
 * Check for scheduled posts that need to be published and publish them
 */
async function checkAndPublishScheduledPosts() {
  try {
    const now = new Date();

    logger.debug('Checking for scheduled posts', { currentTime: now.toISOString() });

    // Find all posts that are scheduled and due for publishing
    const dueSchedules = await prisma.schedule.findMany({
      where: {
        status: 'PENDING',
        scheduled_at: {
          lte: now, // Less than or equal to current time
        },
      },
      include: {
        post: {
          include: {
            channel: true,
            media: true,
            buttons: true,
          },
        },
      },
      orderBy: {
        scheduled_at: 'asc',
      },
    });

    if (dueSchedules.length === 0) {
      logger.debug('No scheduled posts due for publishing');
      return;
    }

    logger.info(`Found ${dueSchedules.length} scheduled posts to publish`);

    // Process each scheduled post
    for (const schedule of dueSchedules) {
      try {
        logger.info('Publishing scheduled post', {
          postId: schedule.post_id,
          scheduledAt: schedule.scheduled_at.toISOString(),
          channelId: schedule.post.channel_id,
        });

        // Attempt to publish
        if (!botInstance) {
          throw new Error('Bot instance not available');
        }

        const success = await publishPostToTelegram(botInstance, schedule.post_id);

        if (success) {
          // Update schedule status to PUBLISHED
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              status: 'PUBLISHED',
              published_at: new Date(),
            },
          });

          logger.info('Scheduled post published successfully', {
            postId: schedule.post_id,
            scheduleId: schedule.id,
          });
        } else {
          // Mark as failed
          const errorMsg = 'Failed to publish to Telegram - check telegramPublishService logs';

          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              status: 'FAILED',
              attempts: schedule.attempts + 1,
              last_error: errorMsg,
            },
          });

          logger.error('Failed to publish scheduled post', {
            postId: schedule.post_id,
            scheduleId: schedule.id,
            attempts: schedule.attempts + 1,
            postData: {
              channelId: schedule.post.channel_id,
              text: schedule.post.text?.substring(0, 50),
              mediaCount: schedule.post.media?.length || 0,
              buttonsCount: schedule.post.buttons?.length || 0,
            }
          });
        }
      } catch (error) {
        logger.error('Error publishing scheduled post', {
          error,
          postId: schedule.post_id,
          scheduleId: schedule.id,
        });

        // Update schedule with error
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            status: 'FAILED',
            attempts: schedule.attempts + 1,
            last_error: error instanceof Error ? error.message : String(error),
          },
        });

        // Update post status to FAILED
        await prisma.post.update({
          where: { id: schedule.post_id },
          data: {
            status: PostStatus.FAILED,
          },
        });
      }
    }
  } catch (error) {
    logger.error('Error in scheduler check', { error });
  }
}

/**
 * Manually trigger a check (useful for testing)
 */
export async function triggerSchedulerCheck() {
  logger.info('Manually triggering scheduler check');
  await checkAndPublishScheduledPosts();
}
