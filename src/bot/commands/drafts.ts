/**
 * /drafts command - Manage draft posts
 */

import { CommandContext, Context } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getDrafts } from '../../services/postService.js';
import { InlineKeyboard } from 'grammy';
import { buildPostStatusCallback, CallbackPrefix } from '../utils/callbackData.js';
import { calculatePagination } from '../keyboards/paginationBuilder.js';

const DRAFTS_PER_PAGE = 5;

/**
 * /drafts command handler
 */
export async function draftsCommand(ctx: CommandContext<Context>) {
  const userId = ctx.from?.id;

  try {
    logger.info('/drafts command received', { userId });

    // Get drafts
    const drafts = await getDrafts(100); // Get all drafts, limit to 100

    if (drafts.length === 0) {
      await ctx.reply(
        '📋 У вас пока нет черновиков.\n\n' +
        'Создайте новый пост командой /newpost и выберите "💾 Сохранить как черновик"'
      );
      return;
    }

    // Show first page
    await showDraftList(ctx, drafts, 0);

  } catch (error) {
    logger.error('Error in /drafts command', { error, userId });
    await ctx.reply('❌ Произошла ошибка при загрузке черновиков');
  }
}

/**
 * Show paginated draft list
 */
export async function showDraftList(ctx: Context, drafts: any[], page: number = 0) {
  const pagination = calculatePagination(drafts.length, page, DRAFTS_PER_PAGE);
  const pageItems = drafts.slice(pagination.startIndex, pagination.endIndex);

  const keyboard = new InlineKeyboard();

  // Add draft buttons
  pageItems.forEach(draft => {
    const preview = draft.text.length > 50
      ? draft.text.substring(0, 50) + '...'
      : draft.text;

    const channelName = draft.channel.channel_title || draft.channel.channel_username || 'Unknown';

    let label = `💾 ${preview}`;

    // Truncate label if too long for button
    if (label.length > 60) {
      label = label.substring(0, 57) + '...';
    }

    keyboard.text(label, buildPostStatusCallback('edit', draft.id)).row();
  });

  // Pagination buttons
  if (pagination.hasPrev || pagination.hasNext) {
    keyboard.row();
    if (pagination.hasPrev) {
      keyboard.text('◀️ Пред', `${CallbackPrefix.DRAFT}_pg_${page - 1}`);
    }
    if (pagination.hasNext) {
      keyboard.text('След ▶️', `${CallbackPrefix.DRAFT}_pg_${page + 1}`);
    }
  }

  keyboard.row();
  keyboard.text('❌ Закрыть', CallbackPrefix.EDIT_POST_CANCEL);

  await ctx.reply(
    `📋 Ваши черновики:\n\n` +
    `Всего черновиков: ${drafts.length}\n` +
    `Страница ${pagination.currentPage + 1} из ${pagination.totalPages}`,
    { reply_markup: keyboard }
  );
}
