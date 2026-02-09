/**
 * Validation utilities for user input
 */

const TELEGRAM_LIMITS = {
  MAX_TEXT_LENGTH: 4096,
  MAX_PHOTO_SIZE: 10 * 1024 * 1024, // 10 MB
  MAX_VIDEO_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_DOCUMENT_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_MEDIA_GROUP: 10,
  MAX_BUTTONS_PER_ROW: 8,
  MAX_CAPTION_LENGTH: 1024,
};

/**
 * Validate post text length
 */
export function validateTextLength(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Текст публикации не может быть пустым' };
  }

  if (text.length > TELEGRAM_LIMITS.MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Превышен лимит символов: ${text.length}/${TELEGRAM_LIMITS.MAX_TEXT_LENGTH}`,
    };
  }

  return { valid: true };
}

/**
 * Validate media file size
 */
export function validateMediaSize(
  fileSize: number,
  fileType: 'photo' | 'video' | 'document'
): { valid: boolean; error?: string } {
  const limits: Record<string, number> = {
    photo: TELEGRAM_LIMITS.MAX_PHOTO_SIZE,
    video: TELEGRAM_LIMITS.MAX_VIDEO_SIZE,
    document: TELEGRAM_LIMITS.MAX_DOCUMENT_SIZE,
  };

  const maxSize = limits[fileType];
  if (fileSize > maxSize) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `Размер файла (${sizeMB} MB) превышает лимит (${maxSizeMB} MB)`,
    };
  }

  return { valid: true };
}

/**
 * Validate media group size
 */
export function validateMediaGroupSize(count: number): { valid: boolean; error?: string } {
  if (count > TELEGRAM_LIMITS.MAX_MEDIA_GROUP) {
    return {
      valid: false,
      error: `Максимум ${TELEGRAM_LIMITS.MAX_MEDIA_GROUP} медиафайлов в одной публикации`,
    };
  }

  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Неверный формат URL' };
  }
}

/**
 * Validate button text
 */
export function validateButtonText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Текст кнопки не может быть пустым' };
  }

  if (text.length > 64) {
    return { valid: false, error: 'Текст кнопки не может превышать 64 символа' };
  }

  return { valid: true };
}

/**
 * Validate scheduled date
 */
export function validateScheduledDate(date: Date): { valid: boolean; error?: string } {
  const now = new Date();

  if (date <= now) {
    return { valid: false, error: 'Дата публикации должна быть в будущем' };
  }

  // Check if date is not too far in future (1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    return {
      valid: false,
      error: 'Дата публикации не может быть больше чем через год',
    };
  }

  return { valid: true };
}

/**
 * Validate HTML formatting
 */
export function validateHTML(text: string): { valid: boolean; error?: string } {
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'spoiler'];
  const tagPattern = /<\/?([a-z]+)[^>]*>/gi;

  let match;
  const openTags: string[] = [];

  while ((match = tagPattern.exec(text)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();

    // Check if tag is allowed
    if (!allowedTags.includes(tagName)) {
      return {
        valid: false,
        error: `Недопустимый HTML-тег: <${tagName}>. Разрешены: ${allowedTags.join(', ')}`,
      };
    }

    // Track opening/closing tags
    if (fullTag.startsWith('</')) {
      const lastOpen = openTags.pop();
      if (lastOpen !== tagName) {
        return {
          valid: false,
          error: `Неправильная вложенность тегов: ожидается </${lastOpen}>, найден </${tagName}>`,
        };
      }
    } else if (!fullTag.endsWith('/>')) {
      openTags.push(tagName);
    }
  }

  if (openTags.length > 0) {
    return {
      valid: false,
      error: `Незакрытые HTML-теги: ${openTags.map(t => `<${t}>`).join(', ')}`,
    };
  }

  return { valid: true };
}

export const LIMITS = TELEGRAM_LIMITS;
