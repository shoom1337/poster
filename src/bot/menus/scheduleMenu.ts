/**
 * Schedule menu - different views for scheduled posts
 */

import { Context, InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getScheduleView, updateScheduleView } from '../utils/sessionState.js';
import {
  getPostsForDay,
  getWeekSchedule,
  getMonthSchedule,
} from '../../services/scheduleQueryService.js';
import { CallbackPrefix, buildPostCallback } from '../utils/callbackData.js';
import { formatDate, formatDateTime, formatDateShort } from '../../utils/formatters.js';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { buildCalendarKeyboard } from '../keyboards/calendarBuilder.js';

/**
 * Show day view
 */
export async function showDayView(ctx: Context, date: Date = new Date()) {
  try {
    updateScheduleView(ctx, { mode: 'days', currentDate: date });

    const posts = await getPostsForDay(date);

    const keyboard = new InlineKeyboard();

    if (posts.length > 0) {
      posts.forEach(post => {
        const preview = post.text.length > 40
          ? post.text.substring(0, 40) + '...'
          : post.text;

        const timeStr = post.schedule?.scheduled_at
          ? format(post.schedule.scheduled_at, 'HH:mm', { locale: ru })
          : '';

        const label = `⏰ ${timeStr} - ${preview}`;

        keyboard.text(
          label.length > 60 ? label.substring(0, 57) + '...' : label,
          `${CallbackPrefix.SCHEDULE_POST}_${post.id}`
        ).row();
      });
    } else {
      keyboard.text('Нет постов на этот день', 'sch_ignore').row();
    }

    // Navigation
    keyboard.row();
    keyboard
      .text('◀️ Пред', `${CallbackPrefix.SCHEDULE}_day_prev`)
      .text('Сегодня', `${CallbackPrefix.SCHEDULE}_day_today`)
      .text('След ▶️', `${CallbackPrefix.SCHEDULE}_day_next`);

    // View mode buttons
    keyboard.row();
    keyboard
      .text('📆 Недели', CallbackPrefix.SCHEDULE_WEEKS)
      .text('🗓 Месяцы', CallbackPrefix.SCHEDULE_MONTHS);

    const dateStr = formatDate(date);
    await ctx.editMessageText(
      `📅 Расписание на ${dateStr}\n\n` +
      `Постов: ${posts.length}`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    logger.error('Error showing day view', { error, date });
    await ctx.reply('❌ Ошибка при загрузке расписания на день');
  }
}

/**
 * Show week view
 */
export async function showWeekView(ctx: Context, date: Date = new Date()) {
  try {
    updateScheduleView(ctx, { mode: 'weeks', currentDate: date });

    const weekSchedule = await getWeekSchedule(date);

    const keyboard = new InlineKeyboard();

    // Show each day of the week
    weekSchedule.days.forEach(day => {
      const dayName = format(day.date, 'EEEE, d MMM', { locale: ru });
      const emoji = day.count > 0 ? '📌' : '⚪️';
      const label = `${emoji} ${dayName} (${day.count})`;

      keyboard.text(label, `${CallbackPrefix.SCHEDULE}_day_${format(day.date, 'yyyy-MM-dd')}`).row();
    });

    // Navigation
    keyboard.row();
    keyboard
      .text('◀️ Пред неделя', `${CallbackPrefix.SCHEDULE}_week_prev`)
      .text('След неделя ▶️', `${CallbackPrefix.SCHEDULE}_week_next`);

    // View mode buttons
    keyboard.row();
    keyboard
      .text('📅 Дни', CallbackPrefix.SCHEDULE_DAYS)
      .text('🗓 Месяцы', CallbackPrefix.SCHEDULE_MONTHS);

    const startStr = formatDateShort(weekSchedule.startDate);
    const endStr = formatDateShort(weekSchedule.endDate);

    await ctx.editMessageText(
      `📆 Расписание на неделю\n` +
      `${startStr} - ${endStr}\n\n` +
      `Всего постов: ${weekSchedule.totalPosts}`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    logger.error('Error showing week view', { error, date });
    await ctx.reply('❌ Ошибка при загрузке расписания на неделю');
  }
}

/**
 * Show month view (calendar with counts)
 */
export async function showMonthView(ctx: Context, date: Date = new Date()) {
  try {
    updateScheduleView(ctx, { mode: 'months', currentDate: date });

    const monthSchedule = await getMonthSchedule(date);

    // Build calendar with post counts overlay
    const calendar = buildCalendarKeyboard(date);

    // TODO: Enhance calendar to show post counts per day
    // This would require modifying the calendar builder to accept counts

    const monthName = format(date, 'LLLL yyyy', { locale: ru });

    await ctx.editMessageText(
      `🗓 Расписание на ${monthName}\n\n` +
      `Всего постов: ${monthSchedule.totalPosts}\n\n` +
      `Нажмите на день для просмотра`,
      { reply_markup: calendar }
    );

  } catch (error) {
    logger.error('Error showing month view', { error, date });
    await ctx.reply('❌ Ошибка при загрузке расписания на месяц');
  }
}

/**
 * Show post details with actions
 */
export async function showPostDetails(ctx: Context, postId: number) {
  try {
    const { getPostById } = await import('../../services/postService.js');
    const post = await getPostById(postId);

    if (!post) {
      await ctx.answerCallbackQuery({ text: '❌ Пост не найден' });
      return;
    }

    const keyboard = new InlineKeyboard();

    keyboard
      .text('📝 Редактировать', `ep_edit_${postId}`)
      .row()
      .text('🔄 Перенести', `${CallbackPrefix.SCHEDULE_POST}_rs_${postId}`)
      .row()
      .text('📋 Дублировать', `${CallbackPrefix.SCHEDULE_POST}_dup_${postId}`)
      .row()
      .text('🗑 Удалить', `${CallbackPrefix.SCHEDULE_POST}_del_${postId}`)
      .row()
      .text('🔙 Назад', CallbackPrefix.SCHEDULE_BACK);

    const channelName = post.channel.channel_title || post.channel.channel_username || 'Unknown';
    const timeStr = post.schedule?.scheduled_at
      ? formatDateTime(post.schedule.scheduled_at)
      : 'Не задано';

    const textPreview = post.text.length > 200
      ? post.text.substring(0, 200) + '...'
      : post.text;

    const mediaCount = post.media?.length || 0;
    const buttonCount = post.buttons?.length || 0;

    await ctx.editMessageText(
      `📌 Детали поста\n\n` +
      `Канал: ${channelName}\n` +
      `Время: ${timeStr}\n` +
      `Медиа: ${mediaCount}\n` +
      `Кнопки: ${buttonCount}\n\n` +
      `Текст:\n${textPreview}`,
      { reply_markup: keyboard }
    );

  } catch (error) {
    logger.error('Error showing post details', { error, postId });
    await ctx.reply('❌ Ошибка при загрузке поста');
  }
}

/**
 * Handle post deletion
 */
export async function handlePostDeletion(ctx: Context, postId: number) {
  try {
    const { deletePost } = await import('../../services/postService.js');

    const keyboard = new InlineKeyboard()
      .text('✅ Да, удалить', `${CallbackPrefix.SCHEDULE_POST}_del_confirm_${postId}`)
      .text('❌ Отмена', CallbackPrefix.SCHEDULE_BACK);

    await ctx.editMessageText(
      '⚠️ Вы уверены, что хотите удалить этот пост?\n\n' +
      'Это действие нельзя отменить.',
      { reply_markup: keyboard }
    );

  } catch (error) {
    logger.error('Error handling post deletion', { error, postId });
    await ctx.reply('❌ Ошибка при удалении поста');
  }
}

/**
 * Confirm post deletion
 */
export async function confirmPostDeletion(ctx: Context, postId: number) {
  try {
    const { deletePost } = await import('../../services/postService.js');

    await deletePost(postId);

    await ctx.answerCallbackQuery({ text: '✅ Пост удален' });

    // Return to schedule view
    const scheduleView = getScheduleView(ctx);
    if (scheduleView) {
      switch (scheduleView.mode) {
        case 'days':
          await showDayView(ctx, scheduleView.currentDate);
          break;
        case 'weeks':
          await showWeekView(ctx, scheduleView.currentDate);
          break;
        case 'months':
          await showMonthView(ctx, scheduleView.currentDate);
          break;
      }
    }

  } catch (error) {
    logger.error('Error confirming post deletion', { error, postId });
    await ctx.reply('❌ Не удалось удалить пост');
  }
}

/**
 * Handle post duplication
 */
export async function handlePostDuplication(ctx: Context, postId: number) {
  try {
    const { duplicatePost } = await import('../../services/postService.js');

    const newPost = await duplicatePost(postId);

    await ctx.answerCallbackQuery({ text: '✅ Пост дублирован как черновик' });
    await ctx.reply(
      `✅ Пост дублирован\n\n` +
      `Новый пост сохранен как черновик.\n` +
      `Используйте /drafts или /editpost для его редактирования.`
    );

  } catch (error) {
    logger.error('Error duplicating post', { error, postId });
    await ctx.answerCallbackQuery({ text: '❌ Ошибка при дублировании' });
  }
}
