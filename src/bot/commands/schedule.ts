/**
 * /schedule command - View and manage scheduled posts
 */

import { CommandContext, Context, InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getUpcomingPosts } from '../../services/scheduleQueryService.js';
import { CallbackPrefix } from '../utils/callbackData.js';
import { formatDateTime } from '../../utils/formatters.js';
import { updateScheduleView } from '../utils/sessionState.js';

/**
 * /schedule command handler - shows upcoming posts
 */
export async function scheduleCommand(ctx: CommandContext<Context>) {
  const userId = ctx.from?.id;

  try {
    logger.info('/schedule command received', { userId });

    // Initialize schedule view state
    updateScheduleView(ctx, {
      mode: 'days',
      currentDate: new Date(),
    });

    // Get upcoming posts
    const upcomingPosts = await getUpcomingPosts(10);

    if (upcomingPosts.length === 0) {
      const keyboard = new InlineKeyboard()
        .text('📅 Открыть календарь', CallbackPrefix.SCHEDULE_DAYS);

      await ctx.reply(
        '📅 У вас пока нет запланированных постов.\n\n' +
        'Создайте пост с расписанием командой /newpost',
        { reply_markup: keyboard }
      );
      return;
    }

    // Build upcoming posts list
    const keyboard = new InlineKeyboard();

    upcomingPosts.forEach(post => {
      const preview = post.text.length > 40
        ? post.text.substring(0, 40) + '...'
        : post.text;

      const timeStr = post.schedule?.scheduled_at
        ? formatDateTime(post.schedule.scheduled_at)
        : 'Не задано';

      const channelName = post.channel.channel_title || post.channel.channel_username || 'Unknown';

      let label = `⏰ ${timeStr} - ${preview}`;

      // Truncate if too long
      if (label.length > 60) {
        label = label.substring(0, 57) + '...';
      }

      keyboard.text(label, `${CallbackPrefix.SCHEDULE_POST}_${post.id}`).row();
    });

    // View mode buttons
    keyboard.row();
    keyboard
      .text('📅 Дни', CallbackPrefix.SCHEDULE_DAYS)
      .text('📆 Недели', CallbackPrefix.SCHEDULE_WEEKS)
      .text('🗓 Месяцы', CallbackPrefix.SCHEDULE_MONTHS);

    await ctx.reply(
      `📅 Ближайшие запланированные посты:\n\n` +
      `Всего: ${upcomingPosts.length} постов`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    logger.error('Error in /schedule command', { error, userId });
    await ctx.reply('❌ Произошла ошибка при загрузке расписания');
  }
}
