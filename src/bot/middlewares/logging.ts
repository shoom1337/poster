/**
 * Logging middleware
 * Logs all incoming updates and commands
 */
import { Context, NextFunction } from 'grammy';
import { logger, logCommand } from '../../utils/logger.js';
import { prisma } from '../../utils/db.js';

/**
 * Log incoming updates
 */
export async function loggingMiddleware(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const messageText = ctx.message?.text || ctx.callbackQuery?.data;

  // Log the update
  logger.debug('Incoming update', {
    userId,
    chatId,
    messageText,
    updateType: ctx.updateType,
  });

  // Update user's last activity
  if (userId) {
    try {
      await prisma.user.upsert({
        where: { telegram_id: BigInt(userId) },
        create: {
          telegram_id: BigInt(userId),
          username: ctx.from?.username,
          first_name: ctx.from?.first_name,
          last_name: ctx.from?.last_name,
          last_activity_at: new Date(),
        },
        update: {
          last_activity_at: new Date(),
          username: ctx.from?.username,
          first_name: ctx.from?.first_name,
          last_name: ctx.from?.last_name,
        },
      });
    } catch (error) {
      logger.error('Failed to update user activity', { error, userId });
    }
  }

  // Track command if it's a command message
  if (ctx.message?.text?.startsWith('/')) {
    const command = ctx.message.text.split(' ')[0];
    logCommand(userId || 0, command);
  }

  await next();
}

/**
 * Error handling middleware
 */
export async function errorMiddleware(ctx: Context, next: NextFunction) {
  try {
    await next();
  } catch (error) {
    logger.error('Error in bot handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      update: ctx.update,
    });

    await ctx.reply(
      '❌ Произошла ошибка при обработке запроса.\n' +
      'Пожалуйста, попробуйте позже или используйте /cancel для отмены текущего действия.'
    ).catch(() => {
      // Ignore error if can't send message
      logger.error('Failed to send error message to user');
    });
  }
}
