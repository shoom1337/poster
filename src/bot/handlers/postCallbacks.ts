/**
 * Post callbacks router - handles all callback queries for post creation/editing
 */

import type { Filter, Context } from 'grammy';
import { Bot, InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getChannelById } from '../../services/channelService.js';
import { createPost, addMedia, addButton, schedulePost } from '../../services/postService.js';
import { publishPostToTelegram } from '../../services/telegramPublishService.js';
import {
  getPostDraft,
  updatePostDraft,
  clearPostDraft,
  setAwaitingInput,
  clearAwaitingInput,
} from '../utils/sessionState.js';
import {
  parseChannelId,
  parseHour,
  parseMinute,
  CallbackPrefix,
  matchesPrefix,
} from '../utils/callbackData.js';
import {
  parseCalendarDate,
  parseMonthNavigation,
} from '../keyboards/calendarBuilder.js';
import {
  buildTextInputMessage,
  buildMediaUploadMessage,
  buildButtonInputMessage,
  buildTimeSelectionMessage,
  buildDraftPreviewMessage,
  buildPostCreatedMessage,
  buildCancelledMessage,
} from '../utils/messageBuilder.js';
import { buildCalendarKeyboard } from '../keyboards/calendarBuilder.js';
import {
  buildHourPickerKeyboard,
  buildMinutePickerKeyboard,
  buildTimeSelectionKeyboard,
} from '../keyboards/timePickerBuilder.js';
import { set } from 'date-fns';

// Store bot instance for publishing
let botInstance: Bot;

/**
 * Register post callback handlers
 */
export function registerPostCallbacks(bot: Bot) {
  botInstance = bot;
  // New post callbacks
  bot.callbackQuery(/^np_/, handleNewPostCallback);

  // Edit post callbacks
  bot.callbackQuery(/^ep_/, handleEditPostCallback);

  // Schedule callbacks
  bot.callbackQuery(/^sch_/, handleScheduleCallback);

  // Calendar callbacks
  bot.callbackQuery(/^cal_/, handleCalendarCallback);

  // Time picker callbacks
  bot.callbackQuery(/^tim_/, handleTimeCallback);
  bot.callbackQuery(/^min_/, handleMinuteCallback);
}

/**
 * Handle new post callbacks
 */
async function handleNewPostCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  logger.info('New post callback', { userId, data });

  try {
    // Channel selection
    if (matchesPrefix(data, CallbackPrefix.NEW_POST_CHANNEL)) {
      await handleChannelSelection(ctx, data);
      return;
    }

    // Text input
    if (data === CallbackPrefix.NEW_POST_TEXT) {
      await handleTextStep(ctx);
      return;
    }

    // Media actions
    if (data === CallbackPrefix.NEW_POST_MEDIA_ADD) {
      await handleMediaAddStep(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_MEDIA_DONE) {
      await handleMediaDoneStep(ctx);
      return;
    }

    // Button actions
    if (data === CallbackPrefix.NEW_POST_BUTTON) {
      await handleButtonStep(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_BUTTON_ADD) {
      await handleButtonAddStep(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_BUTTON_DONE) {
      await handleButtonDoneStep(ctx);
      return;
    }

    // Time selection
    if (data === CallbackPrefix.NEW_POST_TIME) {
      await handleTimeSelection(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_TIME_NOW) {
      await handlePublishNow(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_TIME_SCHEDULE) {
      await handleScheduleStep(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_TIME_DRAFT) {
      await handleSaveDraft(ctx);
      return;
    }

    if (data === CallbackPrefix.NEW_POST_TIME_TEST) {
      await handleScheduleInTwoMinutes(ctx);
      return;
    }

    // Preview
    if (data === CallbackPrefix.NEW_POST_PREVIEW) {
      await handlePreview(ctx);
      return;
    }

    // Confirm
    if (data === CallbackPrefix.NEW_POST_CONFIRM) {
      await handleConfirm(ctx);
      return;
    }

    // Cancel
    if (data === CallbackPrefix.NEW_POST_CANCEL) {
      await handleCancel(ctx);
      return;
    }

    // Back
    if (data === CallbackPrefix.NEW_POST_BACK) {
      await handleBack(ctx);
      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error in new post callback', {
      error: errorMessage,
      stack: errorStack,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      userId,
      data,
    });

    try {
      await ctx.reply('❌ Произошла ошибка при обработке действия');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
  }
}

/**
 * Handle channel selection
 */
async function handleChannelSelection(ctx: Filter<Context, "callback_query">, data: string) {
  const channelId = parseChannelId(data);
  if (!channelId) {
    await ctx.reply('❌ Неверный ID канала');
    return;
  }

  const channel = await getChannelById(channelId);
  if (!channel) {
    await ctx.reply('❌ Канал не найден');
    return;
  }

  // Update draft
  updatePostDraft(ctx, { channelId, step: 'text' });

  // Show text input step
  await handleTextStep(ctx, channel.channel_title);
}

/**
 * Handle text input step
 */
async function handleTextStep(ctx: Filter<Context, "callback_query">, channelName?: string) {
  const draft = getPostDraft(ctx);
  if (!draft || !draft.channelId) {
    await ctx.reply('❌ Сессия истекла. Начните создание поста заново с /newpost');
    return;
  }

  if (!channelName) {
    const channel = await getChannelById(draft.channelId);
    channelName = channel?.channel_title || 'Канал';
  }

  // Set awaiting input flag
  setAwaitingInput(ctx, { type: 'text', messageId: ctx.callbackQuery.message!.message_id });

  // Show text input instructions
  await ctx.editMessageText(buildTextInputMessage(channelName));
}

/**
 * Handle media add step
 */
async function handleMediaAddStep(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft) {
    await ctx.reply('❌ Сессия истекла');
    return;
  }

  updatePostDraft(ctx, { step: 'media' });

  // Set awaiting input flag
  setAwaitingInput(ctx, { type: 'media', messageId: ctx.callbackQuery.message!.message_id });

  // Show media upload instructions
  const keyboard = new InlineKeyboard()
    .text('✅ Готово', CallbackPrefix.NEW_POST_MEDIA_DONE)
    .row()
    .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
    .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

  await ctx.editMessageText(buildMediaUploadMessage(draft.mediaFiles?.length || 0), {
    reply_markup: keyboard,
  });
}

/**
 * Handle media done step
 */
async function handleMediaDoneStep(ctx: Filter<Context, "callback_query">) {
  clearAwaitingInput(ctx);
  updatePostDraft(ctx, { step: 'buttons' });

  // Move to button step
  await handleButtonStep(ctx);
}

/**
 * Handle button step (skip or add)
 */
async function handleButtonStep(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft) {
    await ctx.reply('❌ Сессия истекла');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('🔘 Добавить кнопки', CallbackPrefix.NEW_POST_BUTTON_ADD)
    .row()
    .text('⏭️ Пропустить', CallbackPrefix.NEW_POST_TIME)
    .row()
    .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
    .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

  const mediaCount = draft.mediaFiles?.length || 0;
  const message =
    `✅ Медиа добавлено: ${mediaCount} файлов\n\n` +
    `Добавить кнопки под публикацией?`;

  await ctx.editMessageText(message, { reply_markup: keyboard });
}

/**
 * Handle button add step
 */
async function handleButtonAddStep(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft) {
    await ctx.reply('❌ Сессия истекла');
    return;
  }

  updatePostDraft(ctx, { step: 'buttons' });

  // Set awaiting input flag
  setAwaitingInput(ctx, { type: 'button', messageId: ctx.callbackQuery.message!.message_id });

  logger.info('Button add step - awaiting input set', {
    userId: ctx.from?.id,
    awaitingType: 'button',
    currentButtons: draft.buttons?.length || 0,
  });

  // Show button input instructions
  const keyboard = new InlineKeyboard()
    .text('✅ Готово', CallbackPrefix.NEW_POST_BUTTON_DONE)
    .row()
    .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
    .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

  await ctx.editMessageText(buildButtonInputMessage(draft.buttons?.length || 0), {
    reply_markup: keyboard,
  });
}

/**
 * Handle button done step
 */
async function handleButtonDoneStep(ctx: Filter<Context, "callback_query">) {
  clearAwaitingInput(ctx);
  updatePostDraft(ctx, { step: 'time' });

  // Move to time selection
  await handleTimeSelection(ctx);
}

/**
 * Handle time selection
 */
async function handleTimeSelection(ctx: Filter<Context, "callback_query">) {
  const keyboard = buildTimeSelectionKeyboard();

  await ctx.editMessageText(buildTimeSelectionMessage(), {
    reply_markup: keyboard,
  });
}

/**
 * Handle publish now
 */
async function handlePublishNow(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);

  logger.info('Publishing post now', {
    hasDraft: !!draft,
    channelId: draft?.channelId,
    hasText: !!draft?.text,
    textLength: draft?.text?.length
  });

  if (!draft || !draft.channelId || !draft.text) {
    try {
      await ctx.reply('❌ Недостаточно данных для публикации');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
    return;
  }

  try {
    logger.info('Creating post with data', {
      channelId: draft.channelId,
      channelIdType: typeof draft.channelId,
      textLength: draft.text.length,
      status: 'PUBLISHED'
    });

    // Create post
    const post = await createPost({
      channelId: draft.channelId,
      text: draft.text,
      status: 'PUBLISHED',
    });

    // Add media if any
    if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      for (const media of draft.mediaFiles) {
        await addMedia(
          post.id,
          media.fileId,
          media.fileType,
          media.fileSize,
          media.caption
        );
      }
    }

    // Add buttons if any
    if (draft.buttons && draft.buttons.length > 0) {
      for (const button of draft.buttons) {
        await addButton(post.id, button.text, button.url, button.row, button.position);
      }
    }

    // Publish to Telegram channel
    const published = await publishPostToTelegram(botInstance, post.id);

    const channel = await getChannelById(draft.channelId);
    const channelName = channel?.channel_title || 'Канал';

    const successMessage = published
      ? `✅ Пост успешно опубликован в канал!\n\n📢 Канал: ${channelName}\n🆔 ID поста: ${post.id}`
      : `⚠️ Пост сохранен в базе данных, но не удалось опубликовать в канал.\n\n📢 Канал: ${channelName}\n🆔 ID поста: ${post.id}\n\nПроверьте права бота в канале.`;

    try {
      await ctx.editMessageText(successMessage);
    } catch (editError) {
      logger.warn('Failed to edit message, sending new one', { editError });
      try {
        await ctx.reply(successMessage);
      } catch (replyError) {
        logger.error('Failed to send reply message', { replyError });
        // Swallow this error - post is already created successfully
      }
    }

    // Clear draft
    clearPostDraft(ctx);
  } catch (error) {
    logger.error('Error publishing post', { error });
    try {
      await ctx.reply('❌ Не удалось опубликовать пост');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
  }
}

/**
 * Handle schedule step
 */
async function handleScheduleStep(ctx: Filter<Context, "callback_query">) {
  const keyboard = buildCalendarKeyboard();

  await ctx.editMessageText('📅 Выберите дату публикации:', {
    reply_markup: keyboard,
  });
}

/**
 * Handle save draft
 */
async function handleSaveDraft(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft || !draft.channelId || !draft.text) {
    try {
      await ctx.reply('❌ Недостаточно данных для сохранения черновика');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
    return;
  }

  try {
    // Create post as draft
    const post = await createPost({
      channelId: draft.channelId,
      text: draft.text,
      status: 'DRAFT',
    });

    // Add media if any
    if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      for (const media of draft.mediaFiles) {
        await addMedia(
          post.id,
          media.fileId,
          media.fileType,
          media.fileSize,
          media.caption
        );
      }
    }

    // Add buttons if any
    if (draft.buttons && draft.buttons.length > 0) {
      for (const button of draft.buttons) {
        await addButton(post.id, button.text, button.url, button.row, button.position);
      }
    }

    const channel = await getChannelById(draft.channelId);
    const channelName = channel?.channel_title || 'Канал';

    try {
      await ctx.editMessageText(buildPostCreatedMessage(channelName, undefined, true));
    } catch (editError) {
      logger.warn('Failed to edit message, sending new one', { editError });
      try {
        await ctx.reply(buildPostCreatedMessage(channelName, undefined, true));
      } catch (replyError) {
        logger.error('Failed to send reply message', { replyError });
        // Swallow this error - post is already created successfully
      }
    }

    // Clear draft
    clearPostDraft(ctx);
  } catch (error) {
    logger.error('Error saving draft', { error });
    try {
      await ctx.reply('❌ Не удалось сохранить черновик');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
  }
}

/**
 * Handle preview
 */
async function handlePreview(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft) {
    await ctx.reply('❌ Сессия истекла');
    return;
  }

  const channel = draft.channelId ? await getChannelById(draft.channelId) : null;
  const channelName = channel?.channel_title;

  const keyboard = new InlineKeyboard()
    .text('✅ Подтвердить', CallbackPrefix.NEW_POST_CONFIRM)
    .row()
    .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
    .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

  await ctx.editMessageText(buildDraftPreviewMessage(draft, channelName), {
    reply_markup: keyboard,
  });
}

/**
 * Handle confirm
 */
async function handleConfirm(ctx: Filter<Context, "callback_query">) {
  try {
    // Depending on whether it's scheduled, draft, or immediate, call appropriate handler
    const draft = getPostDraft(ctx);
    if (!draft) {
      await ctx.reply('❌ Сессия истекла');
      return;
    }

    if (draft.scheduledAt) {
      // Scheduled post - save with schedule
      await handleScheduledPost(ctx);
    } else if (draft.status === 'DRAFT') {
      await handleSaveDraft(ctx);
    } else {
      await handlePublishNow(ctx);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error in handleConfirm', {
      error: errorMessage,
      stack: errorStack,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorDetails: error,
    });
    // Don't rethrow - error is already logged and post might be created
  }
}

/**
 * Handle schedule in 2 minutes (for testing)
 */
async function handleScheduleInTwoMinutes(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft || !draft.channelId || !draft.text) {
    try {
      await ctx.reply('❌ Недостаточно данных');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
    return;
  }

  // Set scheduled time to 2 minutes from now
  const scheduledAt = new Date();
  scheduledAt.setMinutes(scheduledAt.getMinutes() + 2);

  updatePostDraft(ctx, { scheduledAt });

  logger.info('Setting test schedule (2 minutes)', {
    now: new Date().toISOString(),
    scheduledAt: scheduledAt.toISOString(),
  });

  // Call the regular scheduled post handler
  await handleScheduledPost(ctx);
}

/**
 * Handle scheduled post creation
 */
async function handleScheduledPost(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft || !draft.channelId || !draft.text || !draft.scheduledAt) {
    try {
      await ctx.reply('❌ Недостаточно данных');
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
    return;
  }

  try {
    // Create post
    const post = await createPost({
      channelId: draft.channelId,
      text: draft.text,
      status: 'SCHEDULED',
    });

    // Add media
    if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      for (const media of draft.mediaFiles) {
        await addMedia(
          post.id,
          media.fileId,
          media.fileType,
          media.fileSize,
          media.caption
        );
      }
    }

    // Add buttons
    if (draft.buttons && draft.buttons.length > 0) {
      for (const button of draft.buttons) {
        await addButton(post.id, button.text, button.url, button.row, button.position);
      }
    }

    // Convert scheduledAt to Date if it's a string (after Redis deserialization)
    const scheduledAtDate = typeof draft.scheduledAt === 'string'
      ? new Date(draft.scheduledAt)
      : draft.scheduledAt;

    // Schedule
    await schedulePost(post.id, scheduledAtDate);

    logger.info('Scheduled post created', {
      postId: post.id,
      channelId: draft.channelId,
      scheduledAt: scheduledAtDate.toISOString(),
      now: new Date().toISOString(),
    });

    // Notify user about successful creation
    try {
      const channel = await getChannelById(draft.channelId);
      const channelName = channel?.channel_title || 'Канал';
      const message = buildPostCreatedMessage(channelName, scheduledAtDate);

      logger.info('Attempting to send success message', {
        channelName,
        scheduledAt: scheduledAtDate.toISOString(),
      });

      try {
        await ctx.editMessageText(message);
        logger.info('Success message sent via editMessageText');
      } catch (editError) {
        logger.warn('Failed to edit message, sending new one', {
          error: editError instanceof Error ? editError.message : String(editError),
        });
        await ctx.reply(message);
        logger.info('Success message sent via reply');
      }
    } catch (notificationError) {
      // Log but don't fail - post is already created
      logger.error('Failed to notify user about successful post creation', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        stack: notificationError instanceof Error ? notificationError.stack : undefined,
      });
    }

    clearPostDraft(ctx);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Error creating scheduled post', {
      error: errorMessage,
      stack: errorStack,
      errorDetails: error,
      draft: {
        channelId: draft?.channelId,
        hasText: !!draft?.text,
        textLength: draft?.text?.length,
        hasScheduledAt: !!draft?.scheduledAt,
        scheduledAt: draft?.scheduledAt instanceof Date
          ? draft.scheduledAt.toISOString()
          : draft?.scheduledAt,
      },
    });

    try {
      await ctx.reply('❌ Не удалось запланировать пост: ' + errorMessage);
    } catch (replyError) {
      logger.error('Failed to send error message', { replyError });
    }
  }
}

/**
 * Handle cancel
 */
async function handleCancel(ctx: Filter<Context, "callback_query">) {
  clearPostDraft(ctx);
  await ctx.editMessageText(buildCancelledMessage('Создание публикации'));
}

/**
 * Handle back navigation
 */
async function handleBack(ctx: Filter<Context, "callback_query">) {
  const draft = getPostDraft(ctx);
  if (!draft) return;

  // Navigate back based on current step
  switch (draft.step) {
    case 'text':
      // Back to channel selection - would need to re-implement
      await ctx.reply('Используйте /newpost для начала заново');
      break;
    case 'media':
      updatePostDraft(ctx, { step: 'text' });
      await handleTextStep(ctx);
      break;
    case 'buttons':
      updatePostDraft(ctx, { step: 'media' });
      await handleMediaAddStep(ctx);
      break;
    case 'time':
      updatePostDraft(ctx, { step: 'buttons' });
      await handleButtonStep(ctx);
      break;
    default:
      break;
  }
}

/**
 * Handle calendar callbacks
 */
async function handleCalendarCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  // Month navigation
  if (data.startsWith('cal_prev_') || data.startsWith('cal_next_')) {
    const newDate = parseMonthNavigation(data);
    if (newDate) {
      const keyboard = buildCalendarKeyboard(newDate);
      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    }
    return;
  }

  // Date selection
  const selectedDate = parseCalendarDate(data);
  if (!selectedDate) {
    return;
  }

  // Show hour picker
  const keyboard = buildHourPickerKeyboard();
  await ctx.editMessageText('🕐 Выберите час:', {
    reply_markup: keyboard,
  });

  // Store selected date in draft (without time yet)
  updatePostDraft(ctx, { scheduledAt: selectedDate });
}

/**
 * Handle time (hour) callbacks
 */
async function handleTimeCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  if (data === CallbackPrefix.TIME_BACK) {
    // Back to calendar
    await handleScheduleStep(ctx);
    return;
  }

  const hour = parseHour(data);
  if (hour === null) return;

  // Show minute picker
  const keyboard = buildMinutePickerKeyboard(hour);
  await ctx.editMessageText(`🕐 Выберите минуты (${hour.toString().padStart(2, '0')}:xx):`, {
    reply_markup: keyboard,
  });

  // Store hour in draft
  const draft = getPostDraft(ctx);
  if (draft && draft.scheduledAt) {
    // Convert to Date if it's a string (after Redis deserialization)
    const scheduledAtDate = typeof draft.scheduledAt === 'string'
      ? new Date(draft.scheduledAt)
      : draft.scheduledAt;
    const updatedDate = set(scheduledAtDate, { hours: hour, minutes: 0, seconds: 0 });
    updatePostDraft(ctx, { scheduledAt: updatedDate });
  }
}

/**
 * Handle minute callbacks
 */
async function handleMinuteCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  const minute = parseMinute(data);
  if (minute === null) return;

  // Update scheduled time with minute
  const draft = getPostDraft(ctx);
  if (!draft || !draft.scheduledAt) return;

  // Convert to Date if it's a string (after Redis deserialization)
  const scheduledAtDate = typeof draft.scheduledAt === 'string'
    ? new Date(draft.scheduledAt)
    : draft.scheduledAt;
  const finalDate = set(scheduledAtDate, { minutes: minute });
  updatePostDraft(ctx, { scheduledAt: finalDate, step: 'preview' });

  // Show preview
  await handlePreview(ctx);
}

/**
 * Handle edit post callbacks
 */
async function handleEditPostCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  logger.info('Edit post callback', { userId, data });

  try {
    // Import edit menu handlers
    const {
      loadPostForEdit,
      showEditMenu,
      handleTextEdit,
      handleMediaEdit,
      handleButtonEdit,
      handleTimeEdit,
      handlePreviewRequest,
      handleSaveEdit,
    } = await import('../menus/postEditMenu.js');

    // Post selection for editing
    if (data.startsWith('ep_edit_')) {
      const postId = parseInt(data.replace('ep_edit_', ''), 10);
      await loadPostForEdit(ctx, postId);
      return;
    }

    // Pagination
    if (data.startsWith('ep_pg_')) {
      const page = parseInt(data.replace('ep_pg_', ''), 10);
      const { showPostList } = await import('../commands/editpost.js');
      const { prisma } = await import('../../utils/db.js');
      const { PostStatus } = await import('@prisma/client');

      const posts = await prisma.post.findMany({
        where: {
          status: { in: [PostStatus.DRAFT, PostStatus.SCHEDULED] },
        },
        include: {
          channel: true,
          schedule: true,
        },
        orderBy: [
          { status: 'asc' },
          { created_at: 'desc' },
        ],
      });

      await ctx.editMessageText('Загрузка...');
      await showPostList(ctx, posts, page);
      return;
    }

    // Text edit
    if (data === CallbackPrefix.EDIT_POST_TEXT) {
      await handleTextEdit(ctx);
      return;
    }

    // Media edit
    if (data === CallbackPrefix.EDIT_POST_MEDIA) {
      await handleMediaEdit(ctx);
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_MEDIA_ADD) {
      setAwaitingInput(ctx, { type: 'media', messageId: ctx.callbackQuery.message!.message_id });
      await ctx.editMessageText(buildMediaUploadMessage(0) + '\n\nОтправьте медиа файлы...');
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_MEDIA_DONE) {
      clearAwaitingInput(ctx);
      await showEditMenu(ctx);
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_MEDIA_CLEAR) {
      updatePostDraft(ctx, { mediaFiles: [] });
      await ctx.answerCallbackQuery({ text: 'Медиа очищено' });
      await handleMediaEdit(ctx);
      return;
    }

    // Button edit
    if (data === CallbackPrefix.EDIT_POST_BUTTONS) {
      await handleButtonEdit(ctx);
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_BUTTON_ADD) {
      setAwaitingInput(ctx, { type: 'button', messageId: ctx.callbackQuery.message!.message_id });
      await ctx.editMessageText(buildButtonInputMessage(0) + '\n\nВведите кнопку в формате: Текст | URL');
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_BUTTON_DONE) {
      clearAwaitingInput(ctx);
      await showEditMenu(ctx);
      return;
    }

    if (data === CallbackPrefix.EDIT_POST_BUTTON_CLEAR) {
      updatePostDraft(ctx, { buttons: [] });
      await ctx.answerCallbackQuery({ text: 'Кнопки очищены' });
      await handleButtonEdit(ctx);
      return;
    }

    // Time edit
    if (data === CallbackPrefix.EDIT_POST_TIME) {
      await handleTimeEdit(ctx);
      return;
    }

    // Preview
    if (data === CallbackPrefix.EDIT_POST_PREVIEW) {
      await handlePreviewRequest(ctx);
      return;
    }

    // Save
    if (data === CallbackPrefix.EDIT_POST_SAVE) {
      await handleSaveEdit(ctx);
      clearPostDraft(ctx);
      return;
    }

    // Cancel
    if (data === CallbackPrefix.EDIT_POST_CANCEL) {
      clearPostDraft(ctx);
      await ctx.editMessageText(buildCancelledMessage('Редактирование публикации'));
      return;
    }

    // Back
    if (data === CallbackPrefix.EDIT_POST_BACK) {
      await showEditMenu(ctx);
      return;
    }

  } catch (error) {
    logger.error('Error in edit post callback', { error, userId, data });
    await ctx.reply('❌ Произошла ошибка при обработке действия');
  }
}

/**
 * Handle schedule callbacks
 */
async function handleScheduleCallback(ctx: Filter<Context, "callback_query">) {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  const userId = ctx.from?.id;
  logger.info('Schedule callback', { userId, data });

  try {
    const {
      showDayView,
      showWeekView,
      showMonthView,
      showPostDetails,
      handlePostDeletion,
      confirmPostDeletion,
      handlePostDuplication,
    } = await import('../menus/scheduleMenu.js');
    const { getScheduleView } = await import('../utils/sessionState.js');
    const { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } = await import('date-fns');

    // View mode switches
    if (data === CallbackPrefix.SCHEDULE_DAYS) {
      await showDayView(ctx);
      return;
    }

    if (data === CallbackPrefix.SCHEDULE_WEEKS) {
      await showWeekView(ctx);
      return;
    }

    if (data === CallbackPrefix.SCHEDULE_MONTHS) {
      await showMonthView(ctx);
      return;
    }

    // Day navigation
    if (data === CallbackPrefix.SCHEDULE + '_day_prev') {
      const view = getScheduleView(ctx);
      const currentDate = view?.currentDate || new Date();
      await showDayView(ctx, subDays(currentDate, 1));
      return;
    }

    if (data === CallbackPrefix.SCHEDULE + '_day_next') {
      const view = getScheduleView(ctx);
      const currentDate = view?.currentDate || new Date();
      await showDayView(ctx, addDays(currentDate, 1));
      return;
    }

    if (data === CallbackPrefix.SCHEDULE + '_day_today') {
      await showDayView(ctx, new Date());
      return;
    }

    // Specific day selection from week view
    if (data.startsWith(CallbackPrefix.SCHEDULE + '_day_')) {
      const dateStr = data.replace(CallbackPrefix.SCHEDULE + '_day_', '');
      const selectedDate = new Date(dateStr);
      if (!isNaN(selectedDate.getTime())) {
        await showDayView(ctx, selectedDate);
      }
      return;
    }

    // Week navigation
    if (data === CallbackPrefix.SCHEDULE + '_week_prev') {
      const view = getScheduleView(ctx);
      const currentDate = view?.currentDate || new Date();
      await showWeekView(ctx, subWeeks(currentDate, 1));
      return;
    }

    if (data === CallbackPrefix.SCHEDULE + '_week_next') {
      const view = getScheduleView(ctx);
      const currentDate = view?.currentDate || new Date();
      await showWeekView(ctx, addWeeks(currentDate, 1));
      return;
    }

    // Post details
    if (data.startsWith(CallbackPrefix.SCHEDULE_POST + '_')) {
      const parts = data.split('_');

      // Deletion confirmation
      if (parts.includes('del') && parts.includes('confirm')) {
        const postId = parseInt(parts[parts.length - 1], 10);
        await confirmPostDeletion(ctx, postId);
        return;
      }

      // Deletion request
      if (parts.includes('del')) {
        const postId = parseInt(parts[parts.length - 1], 10);
        await handlePostDeletion(ctx, postId);
        return;
      }

      // Duplication
      if (parts.includes('dup')) {
        const postId = parseInt(parts[parts.length - 1], 10);
        await handlePostDuplication(ctx, postId);
        return;
      }

      // Reschedule (time edit - reuse from edit post)
      if (parts.includes('rs')) {
        const postId = parseInt(parts[parts.length - 1], 10);
        // Load post for editing and show time picker
        const { loadPostForEdit } = await import('../menus/postEditMenu.js');
        await loadPostForEdit(ctx, postId);
        // Show time selection directly
        const keyboard = buildTimeSelectionKeyboard();
        await ctx.reply('⏰ Выберите новое время публикации:', {
          reply_markup: keyboard,
        });
        return;
      }

      // Default: show post details
      const postId = parseInt(parts[parts.length - 1], 10);
      await showPostDetails(ctx, postId);
      return;
    }

    // Back to schedule
    if (data === CallbackPrefix.SCHEDULE_BACK) {
      const view = getScheduleView(ctx);
      if (view) {
        switch (view.mode) {
          case 'days':
            await showDayView(ctx, view.currentDate);
            break;
          case 'weeks':
            await showWeekView(ctx, view.currentDate);
            break;
          case 'months':
            await showMonthView(ctx, view.currentDate);
            break;
        }
      }
      return;
    }

  } catch (error) {
    logger.error('Error in schedule callback', { error, userId, data });
    await ctx.reply('❌ Произошла ошибка при обработке действия');
  }
}
