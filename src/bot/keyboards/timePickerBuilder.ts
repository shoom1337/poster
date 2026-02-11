/**
 * Time picker keyboard builder
 */

import { InlineKeyboard } from 'grammy';
import { buildTimeCallback, buildMinuteCallback, CallbackPrefix } from '../utils/callbackData.js';

/**
 * Build hour selection keyboard (00-23)
 */
export function buildHourPickerKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard.text('🕐 Выберите час:', 'tim_ignore').row();

  // 6 rows x 4 columns for 24 hours
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const hour = row * 4 + col;
      const hourStr = hour.toString().padStart(2, '0');
      keyboard.text(`${hourStr}:00`, buildTimeCallback(hour));
    }
    keyboard.row();
  }

  keyboard.text('🔙 Назад', CallbackPrefix.TIME_BACK);

  return keyboard;
}

/**
 * Build minute selection keyboard (00, 15, 30, 45)
 */
export function buildMinutePickerKeyboard(selectedHour: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const hourStr = selectedHour.toString().padStart(2, '0');
  keyboard.text(`🕐 Выберите минуты (${hourStr}:xx):`, 'min_ignore').row();

  // 4 minute options
  const minutes = [0, 15, 30, 45];
  minutes.forEach(min => {
    const minStr = min.toString().padStart(2, '0');
    keyboard.text(`${hourStr}:${minStr}`, buildMinuteCallback(min));
  });
  keyboard.row();

  keyboard.text('🔙 Назад', CallbackPrefix.TIME_BACK);

  return keyboard;
}

/**
 * Build quick time selection keyboard (Now / Schedule / Draft)
 */
export function buildTimeSelectionKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  keyboard
    .text('🚀 Опубликовать сейчас', CallbackPrefix.NEW_POST_TIME_NOW)
    .row()
    .text('⏰ Запланировать', CallbackPrefix.NEW_POST_TIME_SCHEDULE)
    .text('🧪 Через 2 мин', CallbackPrefix.NEW_POST_TIME_TEST)
    .row()
    .text('💾 Сохранить как черновик', CallbackPrefix.NEW_POST_TIME_DRAFT)
    .row()
    .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
    .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

  return keyboard;
}
