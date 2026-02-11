/**
 * Message text builder utilities for bot responses
 */

import { Post, Channel, Media, PostButton } from '@prisma/client';
import { formatDate, formatPostPreview, formatPostStatus } from '../../utils/formatters.js';
import { PostDraft } from '../../types/session.js';

/**
 * Post with all relations included
 */
type PostWithRelations = Post & {
  channel: Channel;
  media: Media[];
  buttons: PostButton[];
  schedule?: { scheduled_at: Date } | null;
};

/**
 * Build preview message for a post
 */
export function buildPostPreviewMessage(
  post: PostWithRelations,
  detailed: boolean = false
): string {
  const lines: string[] = ['📋 Предпросмотр публикации\n'];

  lines.push(`Канал: ${post.channel.channel_title}`);

  if (post.schedule?.scheduled_at) {
    lines.push(`Время публикации: ${formatDate(post.schedule.scheduled_at)}`);
  } else if (post.status === 'DRAFT') {
    lines.push(`Статус: Черновик`);
  }

  lines.push('\nТекст:');
  lines.push(detailed ? post.text : formatPostPreview(post.text, 200));

  lines.push(`\nМедиа: ${post.media.length} файлов`);
  lines.push(`Кнопки: ${post.buttons.length} кнопок`);

  if (detailed) {
    lines.push('\nВсё верно?');
  }

  return lines.join('\n');
}

/**
 * Build preview message for a draft post
 */
export function buildDraftPreviewMessage(
  draft: PostDraft,
  channelName?: string
): string {
  const lines: string[] = ['📋 Предпросмотр публикации\n'];

  if (channelName) {
    lines.push(`Канал: ${channelName}`);
  }

  if (draft.scheduledAt) {
    lines.push(`Время публикации: ${formatDate(draft.scheduledAt)}`);
  } else if (draft.status === 'DRAFT') {
    lines.push(`Статус: Черновик`);
  }

  if (draft.text) {
    lines.push('\nТекст:');
    lines.push(formatPostPreview(draft.text, 200));
  }

  const mediaCount = draft.mediaFiles?.length || 0;
  const buttonCount = draft.buttons?.length || 0;

  lines.push(`\nМедиа: ${mediaCount} файлов`);
  lines.push(`Кнопки: ${buttonCount} кнопок`);

  return lines.join('\n');
}

/**
 * Build message for schedule day view
 */
export function buildScheduleDayMessage(date: Date, posts: PostWithRelations[]): string {
  const lines: string[] = [`📅 ${formatDate(date)}\n`];

  lines.push(`Запланировано публикаций: ${posts.length}\n`);

  if (posts.length === 0) {
    lines.push('Нет запланированных публикаций на этот день.');
    return lines.join('\n');
  }

  posts.forEach((post) => {
    const time = post.schedule?.scheduled_at
      ? formatDate(post.schedule.scheduled_at).split(', ')[1] // Extract time part
      : '??:??';
    const preview = formatPostPreview(post.text, 50);
    const status = post.status === 'PUBLISHED' ? '✅' : '⏰';
    lines.push(`${status} ${time} - ${preview}`);
  });

  return lines.join('\n');
}

/**
 * Build message for post list (drafts, scheduled posts, etc.)
 */
export function buildPostListMessage(
  posts: PostWithRelations[],
  title: string,
  page: number,
  totalPages: number
): string {
  const lines: string[] = [`${title}\n`];

  if (posts.length === 0) {
    lines.push('Список пуст.');
    return lines.join('\n');
  }

  lines.push(`Страница ${page} из ${totalPages}\n`);

  posts.forEach((post, index) => {
    const status = formatPostStatus(post.status);
    const preview = formatPostPreview(post.text, 60);
    const time = post.schedule?.scheduled_at
      ? formatDate(post.schedule.scheduled_at)
      : 'Без времени';

    lines.push(`${index + 1}. [${status}] ${preview}`);
    lines.push(`   ${time}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Build message for channel selection
 */
export function buildChannelSelectionMessage(
  _channels: Channel[],
  context: 'newpost' | 'editpost' = 'newpost'
): string {
  const lines: string[] = [];

  if (context === 'newpost') {
    lines.push('📝 Создание публикации\n');
  } else {
    lines.push('✏️ Редактирование канала\n');
  }

  lines.push('Выберите канал для публикации:');

  return lines.join('\n');
}

/**
 * Build message for text input step
 */
export function buildTextInputMessage(channelName: string): string {
  return (
    `✅ Канал выбран: ${channelName}\n\n` +
    `Введите текст публикации:\n` +
    `Поддерживается HTML-форматирование (жирный, курсив, подчеркнутый, код, ссылки)\n` +
    `Максимум 4096 символов\n\n` +
    `Для отмены: /cancel`
  );
}

/**
 * Build message for text confirmation
 */
export function buildTextConfirmationMessage(text: string, charCount: number): string {
  const preview = formatPostPreview(text, 300);
  return (
    `✅ Текст сохранен\n` +
    `Символов: ${charCount} / 4096\n\n` +
    `Превью:\n${preview}\n\n` +
    `Добавить медиафайлы?`
  );
}

/**
 * Build message for media upload step
 */
export function buildMediaUploadMessage(currentCount: number = 0): string {
  return (
    `📎 Добавление медиафайлов\n\n` +
    `Отправьте фото, видео или документы\n` +
    `Текущие файлы: ${currentCount} / 10\n\n` +
    `Когда закончите, нажмите "Готово"`
  );
}

/**
 * Build message for button input step
 */
export function buildButtonInputMessage(currentCount: number = 0): string {
  return (
    `🔘 Добавление кнопок\n\n` +
    `Введите кнопку в формате:\n` +
    `Текст кнопки | https://example.com\n\n` +
    `Текущие кнопки: ${currentCount}\n\n` +
    `Когда закончите, нажмите "Готово"`
  );
}

/**
 * Build message for time selection step
 */
export function buildTimeSelectionMessage(): string {
  return (
    `🕐 Время публикации\n\n` +
    `Когда опубликовать?`
  );
}

/**
 * Build error message for validation failures
 */
export function buildValidationErrorMessage(error: string): string {
  return `❌ Ошибка валидации\n\n${error}\n\nПопробуйте еще раз`;
}

/**
 * Build success message for post creation
 */
export function buildPostCreatedMessage(
  channelName: string,
  scheduledAt?: Date,
  isDraft: boolean = false
): string {
  if (isDraft) {
    return (
      `✅ Черновик сохранен!\n\n` +
      `Канал: ${channelName}\n\n` +
      `Вы можете отредактировать его позже через /drafts`
    );
  }

  if (scheduledAt) {
    return (
      `✅ Публикация запланирована\n\n` +
      `Канал: ${channelName}\n` +
      `Дата и время: ${formatDate(scheduledAt)}\n\n` +
      `Публикация будет отправлена автоматически`
    );
  }

  return (
    `✅ Публикация отправлена!\n\n` +
    `Канал: ${channelName}`
  );
}

/**
 * Build message for no channels available
 */
export function buildNoChannelsMessage(): string {
  return (
    `📝 Создание публикации\n\n` +
    `У вас нет добавленных каналов.\n\n` +
    `Для добавления канала используйте команду /channels`
  );
}

/**
 * Build message for operation cancelled
 */
export function buildCancelledMessage(operation: string): string {
  return `✅ ${operation} отменено`;
}

/**
 * Build message for session expired
 */
export function buildSessionExpiredMessage(): string {
  return (
    `⚠️ Время сессии истекло\n\n` +
    `Пожалуйста, начните операцию заново.`
  );
}
