/**
 * Text input handler for post creation/editing
 */

import { Bot } from 'grammy';
import { logger } from '../../utils/logger.js';
import { validateTextLength, validateHTML } from '../../utils/validators.js';
import {
  getAwaitingInput,
  updatePostDraft,
  clearAwaitingInput,
} from '../utils/sessionState.js';
import {
  buildTextConfirmationMessage,
  buildValidationErrorMessage,
} from '../utils/messageBuilder.js';
import { InlineKeyboard } from 'grammy';
import { CallbackPrefix } from '../utils/callbackData.js';

/**
 * Register text input handler
 */
export function registerTextInputHandler(bot: Bot) {
  bot.on('message:text', async (ctx) => {
    const awaitingInput = getAwaitingInput(ctx);

    logger.debug('Text handler called', {
      userId: ctx.from?.id,
      hasAwaitingInput: !!awaitingInput,
      awaitingType: awaitingInput?.type,
    });

    // Check if we're awaiting text input
    if (awaitingInput?.type !== 'text') {
      return; // Not our message, let other handlers process
    }

    const text = ctx.message.text;
    const userId = ctx.from?.id;

    logger.info('Processing text input', { userId, textLength: text.length });

    // Validate text length
    const lengthValidation = validateTextLength(text);
    if (!lengthValidation.valid) {
      await ctx.reply(buildValidationErrorMessage(lengthValidation.error!));
      return;
    }

    // Validate HTML formatting
    const htmlValidation = validateHTML(text);
    if (!htmlValidation.valid) {
      await ctx.reply(buildValidationErrorMessage(htmlValidation.error!));
      return;
    }

    // Save text to session
    updatePostDraft(ctx, { text, step: 'media' });

    // Clear awaiting flag
    clearAwaitingInput(ctx);

    // Show text confirmation with media options
    const keyboard = new InlineKeyboard()
      .text('📎 Добавить медиа', CallbackPrefix.NEW_POST_MEDIA_ADD)
      .row()
      .text('⏭️ Пропустить', CallbackPrefix.NEW_POST_BUTTON)
      .row()
      .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
      .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

    await ctx.reply(buildTextConfirmationMessage(text, text.length), {
      reply_markup: keyboard,
    });
  });
}
