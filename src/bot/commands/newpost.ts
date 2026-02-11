/**
 * /newpost command handler - Create new post
 */

import type { CommandContext } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../types/context.js';
import { logger } from '../../utils/logger.js';
import { getActiveChannels } from '../../services/channelService.js';
import {
  clearPostDraft,
  setCurrentOperation,
  updatePostDraft,
} from '../utils/sessionState.js';
import {
  buildChannelSelectionMessage,
  buildNoChannelsMessage,
} from '../utils/messageBuilder.js';
import { buildChannelCallback, CallbackPrefix } from '../utils/callbackData.js';

/**
 * Handle /newpost command
 */
export async function newpostCommand(ctx: CommandContext<MyContext>) {
  const userId = ctx.from?.id;
  logger.info('New post command', { userId });

  try {
    // Clear any existing draft
    clearPostDraft(ctx);

    // Set current operation
    setCurrentOperation(ctx, 'newpost');

    // Get active channels
    const channels = await getActiveChannels();

    if (channels.length === 0) {
      await ctx.reply(buildNoChannelsMessage(), {
        reply_markup: new InlineKeyboard().text('⚙️ Управление каналами', 'manage_channels'),
      });
      return;
    }

    // Initialize post draft
    updatePostDraft(ctx, {
      step: 'channel',
      status: 'DRAFT',
    });

    // Build channel selection keyboard
    const keyboard = new InlineKeyboard();

    for (const channel of channels) {
      const channelName = channel.channel_username
        ? `@${channel.channel_username}`
        : channel.channel_title;

      keyboard.text(`📢 ${channelName}`, buildChannelCallback(channel.id)).row();
    }

    keyboard.text('❌ Отмена', CallbackPrefix.NEW_POST_CANCEL);

    // Send channel selection message
    await ctx.reply(buildChannelSelectionMessage(channels, 'newpost'), {
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error in newpost command', { error, userId });
    await ctx.reply('❌ Произошла ошибка при создании публикации');
  }
}
