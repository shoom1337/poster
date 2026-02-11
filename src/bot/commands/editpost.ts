/**
 * /editpost command - Edit existing posts (drafts and scheduled)
 */

import { CommandContext, Context } from 'grammy';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../utils/db.js';
import { PostStatus } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { buildPostStatusCallback, CallbackPrefix } from '../utils/callbackData.js';
import { formatDateTime } from '../../utils/formatters.js';
import { calculatePagination } from '../keyboards/paginationBuilder.js';

const POSTS_PER_PAGE = 5;

/**
 * /editpost command handler
 */
export async function editpostCommand(ctx: CommandContext<Context>) {
  const userId = ctx.from?.id;

  try {
    logger.info('/editpost command received', { userId });

    // Get editable posts (drafts and scheduled)
    const posts = await prisma.post.findMany({
      where: {
        status: {
          in: [PostStatus.DRAFT, PostStatus.SCHEDULED],
        },
      },
      include: {
        channel: true,
        schedule: true,
      },
      orderBy: [
        { status: 'asc' }, // DRAFT first, then SCHEDULED
        { created_at: 'desc' },
      ],
    });

    if (posts.length === 0) {
      await ctx.reply(
        '📝 У вас пока нет черновиков или запланированных постов.\n\n' +
        'Создайте новый пост командой /newpost'
      );
      return;
    }

    // Show first page
    await showPostList(ctx, posts, 0);

  } catch (error) {
    logger.error('Error in /editpost command', { error, userId });
    await ctx.reply('❌ Произошла ошибка при загрузке списка постов');
  }
}

/**
 * Show paginated post list
 */
export async function showPostList(ctx: Context, posts: any[], page: number = 0) {
  const pagination = calculatePagination(posts.length, page, POSTS_PER_PAGE);
  const pageItems = posts.slice(pagination.startIndex, pagination.endIndex);

  const keyboard = new InlineKeyboard();

  // Add post buttons
  pageItems.forEach(post => {
    const preview = post.text.length > 50
      ? post.text.substring(0, 50) + '...'
      : post.text;

    const statusEmoji = post.status === PostStatus.DRAFT ? '💾' : '⏰';
    const channelName = post.channel.channel_title || post.channel.channel_username || 'Unknown';

    let label = `${statusEmoji} ${preview}`;

    if (post.schedule?.scheduled_at) {
      const timeStr = formatDateTime(post.schedule.scheduled_at);
      label += ` (${timeStr})`;
    }

    // Truncate label if too long for button
    if (label.length > 60) {
      label = label.substring(0, 57) + '...';
    }

    keyboard.text(label, buildPostStatusCallback('edit', post.id)).row();
  });

  // Pagination buttons
  if (pagination.hasPrev || pagination.hasNext) {
    keyboard.row();
    if (pagination.hasPrev) {
      keyboard.text('◀️ Пред', `${CallbackPrefix.EDIT_POST_PAGE}_${page - 1}`);
    }
    if (pagination.hasNext) {
      keyboard.text('След ▶️', `${CallbackPrefix.EDIT_POST_PAGE}_${page + 1}`);
    }
  }

  keyboard.row();
  keyboard.text('❌ Отмена', CallbackPrefix.EDIT_POST_CANCEL);

  await ctx.reply(
    `📝 Выберите пост для редактирования:\n\n` +
    `Всего постов: ${posts.length}\n` +
    `Страница ${pagination.currentPage + 1} из ${pagination.totalPages}`,
    { reply_markup: keyboard }
  );
}
