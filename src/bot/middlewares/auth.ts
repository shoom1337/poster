/**
 * Authorization middleware
 * Checks if user is admin before processing any command
 */
import { Context, NextFunction } from 'grammy';
import { logger } from '../../utils/logger.js';

const ADMIN_TELEGRAM_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || '0');

if (ADMIN_TELEGRAM_ID === BigInt(0)) {
  logger.error('ADMIN_TELEGRAM_ID is not set in environment variables');
  throw new Error('ADMIN_TELEGRAM_ID must be set');
}

/**
 * Check if user is authorized admin
 */
export async function authMiddleware(ctx: Context, next: NextFunction) {
  const userId = ctx.from?.id;

  if (!userId) {
    logger.warn('Received update without user ID');
    return;
  }

  // Check if user is admin
  if (BigInt(userId) !== ADMIN_TELEGRAM_ID) {
    logger.warn('Unauthorized access attempt', {
      userId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    });

    await ctx.reply(
      '⛔️ Доступ запрещен\n\n' +
      'У вас нет прав для использования этого бота.'
    );

    return;
  }

  // User is authorized, proceed
  await next();
}

/**
 * Get admin telegram ID
 */
export function getAdminId(): bigint {
  return ADMIN_TELEGRAM_ID;
}
