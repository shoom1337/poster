/**
 * Formatting utilities for dates, text, and messages
 */
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Format date according to spec: "14 февраля (среда), 15:30"
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  // Format: "14 февраля (среда), 15:30"
  const formatted = format(dateObj, "d MMMM (EEEEEE), HH:mm", { locale: ru });
  return formatted;
}

/**
 * Format date for calendar display
 */
export function formatCalendarDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'd MMMM', { locale: ru });
}

/**
 * Format month and year for calendar header
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: ru });
}

/**
 * Get day of week (short form)
 */
export function getDayOfWeek(date: Date): string {
  return format(date, 'EEE', { locale: ru });
}

/**
 * Format post status to Russian
 */
export function formatPostStatus(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: 'Черновик',
    SCHEDULED: 'Запланировано',
    PUBLISHED: 'Опубликовано',
    FAILED: 'Ошибка',
  };

  return statusMap[status] || status;
}

/**
 * Format schedule status to Russian
 */
export function formatScheduleStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: 'Ожидает',
    PUBLISHED: 'Опубликовано',
    FAILED: 'Ошибка',
    CANCELLED: 'Отменено',
  };

  return statusMap[status] || status;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format number with spaces (1000 -> 1 000)
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);

  return `${size} ${sizes[i]}`;
}

/**
 * Format media type to Russian
 */
export function formatMediaType(type: string): string {
  const typeMap: Record<string, string> = {
    PHOTO: 'Фото',
    VIDEO: 'Видео',
    DOCUMENT: 'Документ',
    ANIMATION: 'GIF',
  };

  return typeMap[type] || type;
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format duration (e.g., "2 hours ago")
 */
export function formatDuration(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 30) return `${diffDays} дн назад`;

  return formatDate(dateObj);
}

/**
 * Format post preview with truncation
 */
export function formatPostPreview(text: string, maxLength: number = 150): string {
  // Strip HTML tags for preview
  const stripped = text.replace(/<[^>]*>/g, '');
  return truncateText(stripped, maxLength);
}

/**
 * Format error message for user
 */
export function formatErrorMessage(error: Error | string): string {
  if (typeof error === 'string') return error;

  // Extract meaningful error message
  const message = error.message;

  // Common error translations
  if (message.includes('ETELEGRAM')) {
    return 'Ошибка связи с Telegram API. Повторите попытку позже.';
  }

  if (message.includes('database')) {
    return 'Ошибка базы данных. Обратитесь к администратору.';
  }

  return message;
}
