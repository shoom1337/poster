/**
 * Button input handler for post creation/editing
 */

import { Bot, InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';
import { validateButtonText, validateUrl } from '../../utils/validators.js';
import {
  getAwaitingInput,
  getPostDraft,
  updatePostDraft,
} from '../utils/sessionState.js';
import { buildValidationErrorMessage, buildButtonInputMessage } from '../utils/messageBuilder.js';
import { SessionButton } from '../../types/session.js';
import { CallbackPrefix } from '../utils/callbackData.js';

/**
 * Register button input handler
 */
export function registerButtonInputHandler(bot: Bot) {
  bot.on('message:text', async (ctx) => {
    const awaitingInput = getAwaitingInput(ctx);

    logger.debug('Button handler called', {
      userId: ctx.from?.id,
      hasAwaitingInput: !!awaitingInput,
      awaitingType: awaitingInput?.type,
    });

    // Check if we're awaiting button input
    if (awaitingInput?.type !== 'button') {
      return; // Not our message
    }

    const text = ctx.message.text;
    const userId = ctx.from?.id;
    const draft = getPostDraft(ctx);

    logger.info('Button input handler triggered', {
      userId,
      hasAwaitingInput: !!awaitingInput,
      awaitingType: awaitingInput?.type,
      hasDraft: !!draft,
      text: text.substring(0, 50),
    });

    if (!draft) {
      await ctx.reply('❌ Сессия истекла. Начните создание поста заново с /newpost');
      return;
    }

    logger.info('Processing button input', { userId });

    try {
      // Parse button format: Text | URL
      const parts = text.split('|').map(part => part.trim());

      if (parts.length !== 2) {
        const keyboard = new InlineKeyboard()
          .text('✅ Готово (без кнопок)', CallbackPrefix.NEW_POST_BUTTON_DONE)
          .row()
          .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

        await ctx.reply(
          buildValidationErrorMessage(
            'Неверный формат кнопки.\n\n' +
            'Используйте формат:\n' +
            'Текст кнопки | https://example.com\n\n' +
            'Пример:\n' +
            'Читать статью | https://example.com/article'
          ),
          { reply_markup: keyboard }
        );
        return;
      }

      const [buttonText, url] = parts;

      // Validate button text
      const textValidation = validateButtonText(buttonText);
      if (!textValidation.valid) {
        const keyboard = new InlineKeyboard()
          .text('✅ Готово (без кнопок)', CallbackPrefix.NEW_POST_BUTTON_DONE)
          .row()
          .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

        await ctx.reply(buildValidationErrorMessage(textValidation.error!), {
          reply_markup: keyboard,
        });
        return;
      }

      // Validate URL
      const urlValidation = validateUrl(url);
      if (!urlValidation.valid) {
        const keyboard = new InlineKeyboard()
          .text('✅ Готово (без кнопок)', CallbackPrefix.NEW_POST_BUTTON_DONE)
          .row()
          .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

        await ctx.reply(buildValidationErrorMessage(urlValidation.error!), {
          reply_markup: keyboard,
        });
        return;
      }

      // Get current buttons
      const buttons = draft.buttons || [];

      // Add new button (all buttons in one row for now, can be customized later)
      const newButton: SessionButton = {
        text: buttonText,
        url,
        row: 0,
        position: buttons.length,
      };

      buttons.push(newButton);

      // Update draft
      updatePostDraft(ctx, { buttons });

      logger.info('Button added', {
        userId,
        totalButtons: buttons.length,
      });

      // Send confirmation with keyboard (user can add more buttons or finish)
      const keyboard = new InlineKeyboard()
        .text('✅ Готово', CallbackPrefix.NEW_POST_BUTTON_DONE)
        .row()
        .text('🔙 Назад', CallbackPrefix.NEW_POST_BACK)
        .text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

      await ctx.reply(
        `✅ Кнопка добавлена: "${buttonText}"\n\n` +
        buildButtonInputMessage(buttons.length),
        { reply_markup: keyboard }
      );
    } catch (error) {
      logger.error('Error handling button input', { error, userId });
      await ctx.reply('❌ Произошла ошибка при добавлении кнопки');
    }
  });
}
