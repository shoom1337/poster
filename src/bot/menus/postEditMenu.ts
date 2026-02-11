/**
 * Post edit menu - handles editing of existing posts
 */

import { InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getPostById } from '../../services/postService.js';
import { getPostDraft, updatePostDraft, setAwaitingInput } from '../utils/sessionState.js';
import { CallbackPrefix } from '../utils/callbackData.js';
import { buildTextInputMessage, buildDraftPreviewMessage } from '../utils/messageBuilder.js';
import { prisma } from '../../utils/db.js';
import { PostStatus } from '@prisma/client';

/**
 * Load post into draft for editing
 */
export async function loadPostForEdit(ctx: Context, postId: number) {
  try {
    const post = await getPostById(postId);

    if (!post) {
      await ctx.answerCallbackQuery({ text: '❌ Пост не найден' });
      return;
    }

    // Validate that post is editable
    if (post.status !== PostStatus.DRAFT && post.status !== PostStatus.SCHEDULED) {
      await ctx.answerCallbackQuery({ text: '❌ Можно редактировать только черновики и запланированные посты' });
      return;
    }

    // Load into session
    updatePostDraft(ctx, {
      id: post.id,
      channelId: post.channel_id,
      text: post.text,
      mediaFiles: post.media.map(m => ({
        fileId: m.file_id,
        fileType: m.file_type,
        fileSize: m.file_size || undefined,
        caption: m.caption || undefined,
        position: m.position,
      })),
      buttons: post.buttons.map(b => ({
        text: b.text,
        url: b.url,
        row: b.row,
        position: b.position,
      })),
      scheduledAt: post.schedule?.scheduled_at || undefined,
      status: post.status,
      step: 'preview',
    });

    logger.info('Post loaded for editing', { postId, userId: ctx.from?.id });

    // Show edit menu
    await showEditMenu(ctx);

  } catch (error) {
    logger.error('Error loading post for edit', { error, postId });
    await ctx.answerCallbackQuery({ text: '❌ Ошибка при загрузке поста' });
  }
}

/**
 * Show edit menu with all options
 */
export async function showEditMenu(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft || !draft.id) {
    await ctx.reply('❌ Сессия истекла. Начните заново с /editpost');
    return;
  }

  const keyboard = new InlineKeyboard();

  keyboard
    .text('📝 Изменить текст', CallbackPrefix.EDIT_POST_TEXT)
    .row()
    .text('🖼 Изменить медиа', CallbackPrefix.EDIT_POST_MEDIA)
    .row()
    .text('🔘 Изменить кнопки', CallbackPrefix.EDIT_POST_BUTTONS)
    .row()
    .text('⏰ Изменить время', CallbackPrefix.EDIT_POST_TIME)
    .row()
    .text('👁 Превью', CallbackPrefix.EDIT_POST_PREVIEW)
    .row()
    .text('✅ Сохранить', CallbackPrefix.EDIT_POST_SAVE)
    .text('❌ Отмена', CallbackPrefix.EDIT_POST_CANCEL);

  const statusEmoji = draft.status === PostStatus.DRAFT ? '💾' : '⏰';
  const statusText = draft.status === PostStatus.DRAFT ? 'Черновик' : 'Запланировано';

  await ctx.reply(
    `${statusEmoji} Редактирование поста\n\n` +
    `Статус: ${statusText}\n\n` +
    `Выберите, что хотите изменить:`,
    { reply_markup: keyboard }
  );
}

/**
 * Handle text edit request
 */
export async function handleTextEdit(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  const post = await getPostById(draft.id!);
  if (!post) {
    await ctx.answerCallbackQuery({ text: '❌ Пост не найден' });
    return;
  }

  const channelName = post.channel.channel_title || post.channel.channel_username || 'Unknown';

  await ctx.answerCallbackQuery();
  setAwaitingInput(ctx, { type: 'text', messageId: 0 });

  await ctx.reply(
    `Текущий текст:\n${draft.text}\n\n` +
    buildTextInputMessage(channelName)
  );
}

/**
 * Handle media edit request
 */
export async function handleMediaEdit(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard();

  const currentCount = draft.mediaFiles?.length || 0;

  keyboard
    .text('➕ Добавить медиа', CallbackPrefix.EDIT_POST_MEDIA_ADD)
    .row();

  if (currentCount > 0) {
    keyboard
      .text('🗑 Очистить все медиа', CallbackPrefix.EDIT_POST_MEDIA_CLEAR)
      .row();
  }

  keyboard
    .text('✅ Готово', CallbackPrefix.EDIT_POST_MEDIA_DONE)
    .text('🔙 Назад', CallbackPrefix.EDIT_POST_BACK);

  await ctx.reply(
    `🖼 Редактирование медиа\n\n` +
    `Текущее количество файлов: ${currentCount}\n\n` +
    `Выберите действие:`,
    { reply_markup: keyboard }
  );
}

/**
 * Handle button edit request
 */
export async function handleButtonEdit(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard();

  const currentCount = draft.buttons?.length || 0;

  keyboard
    .text('➕ Добавить кнопку', CallbackPrefix.EDIT_POST_BUTTON_ADD)
    .row();

  if (currentCount > 0) {
    keyboard
      .text('🗑 Очистить все кнопки', CallbackPrefix.EDIT_POST_BUTTON_CLEAR)
      .row();
  }

  keyboard
    .text('✅ Готово', CallbackPrefix.EDIT_POST_BUTTON_DONE)
    .text('🔙 Назад', CallbackPrefix.EDIT_POST_BACK);

  const buttonList = draft.buttons?.map((b, i) => `${i + 1}. ${b.text} → ${b.url}`).join('\n') || 'Нет кнопок';

  await ctx.reply(
    `🔘 Редактирование кнопок\n\n` +
    `Текущие кнопки:\n${buttonList}\n\n` +
    `Выберите действие:`,
    { reply_markup: keyboard }
  );
}

/**
 * Handle time edit request
 */
export async function handleTimeEdit(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  await ctx.answerCallbackQuery();

  // Show time selection (reuse from new post)
  const { buildTimeSelectionKeyboard } = await import('../keyboards/timePickerBuilder.js');

  await ctx.reply(
    '⏰ Выберите время публикации:',
    { reply_markup: buildTimeSelectionKeyboard() }
  );
}

/**
 * Handle preview request
 */
export async function handlePreviewRequest(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  await ctx.answerCallbackQuery();

  const post = await getPostById(draft.id!);
  if (!post) {
    await ctx.reply('❌ Пост не найден');
    return;
  }

  const channelName = post.channel.channel_title || 'Unknown';
  const preview = buildDraftPreviewMessage(draft, channelName);

  await ctx.reply(preview, { parse_mode: 'HTML' });

  // Show edit menu again
  await showEditMenu(ctx);
}

/**
 * Handle save request
 */
export async function handleSaveEdit(ctx: Context) {
  const draft = getPostDraft(ctx);

  if (!draft || !draft.id) {
    await ctx.answerCallbackQuery({ text: '❌ Сессия истекла' });
    return;
  }

  try {
    await ctx.answerCallbackQuery({ text: 'Сохранение...' });

    const { updatePost, addMedia, addButton, schedulePost } = await import('../../services/postService.js');

    // Update post text
    await updatePost(draft.id, {
      text: draft.text!,
      status: draft.status,
    });

    // Update media - delete old, add new
    await prisma.media.deleteMany({
      where: { post_id: draft.id },
    });

    if (draft.mediaFiles && draft.mediaFiles.length > 0) {
      for (const media of draft.mediaFiles) {
        await addMedia(
          draft.id,
          media.fileId,
          media.fileType,
          media.fileSize,
          media.caption
        );
      }
    }

    // Update buttons - delete old, add new
    await prisma.postButton.deleteMany({
      where: { post_id: draft.id },
    });

    if (draft.buttons && draft.buttons.length > 0) {
      for (const button of draft.buttons) {
        await addButton(
          draft.id,
          button.text,
          button.url,
          button.row,
          button.position
        );
      }
    }

    // Update schedule if needed
    if (draft.scheduledAt) {
      // Delete old schedule
      await prisma.schedule.deleteMany({
        where: { post_id: draft.id },
      });

      // Create new schedule
      await schedulePost(draft.id, draft.scheduledAt);
    }

    logger.info('Post updated', { postId: draft.id, userId: ctx.from?.id });

    await ctx.reply('✅ Пост успешно сохранен');

  } catch (error) {
    logger.error('Error saving post edit', { error, postId: draft.id });
    await ctx.reply('❌ Произошла ошибка при сохранении поста');
  }
}
