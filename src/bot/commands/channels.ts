/**
 * /channels command handler
 */
import { CommandContext } from 'grammy';
import { logger } from '../../utils/logger.js';
import { getActiveChannels } from '../../services/channelService.js';
import { InlineKeyboard } from 'grammy';

export async function channelsCommand(ctx: CommandContext<any>) {
  const userId = ctx.from?.id;
  logger.info('Channels command', { userId });

  try {
    const channels = await getActiveChannels();

    if (channels.length === 0) {
      await ctx.reply(
        '📢 **Управление каналами**\n\n' +
        'У вас пока нет добавленных каналов.\n\n' +
        'Для добавления канала:\n' +
        '1. Добавьте бота в канал как администратора\n' +
        '2. Перешлите любое сообщение из канала сюда\n' +
        '3. Я автоматически сохраню канал',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let message = '📢 **Управление каналами**\n\n';
    message += `Всего каналов: ${channels.length}\n\n`;

    const keyboard = new InlineKeyboard();

    for (const channel of channels) {
      const channelName = channel.channel_username
        ? `@${channel.channel_username}`
        : channel.channel_title;
      message += `📌 ${channel.channel_title}\n`;
      message += `   ID: \`${channel.channel_id}\`\n`;
      if (channel.channel_username) {
        message += `   Username: @${channel.channel_username}\n`;
      }
      message += '\n';

      keyboard.text(channelName, `channel_info_${channel.id}`).row();
    }

    keyboard.text('➕ Добавить канал', 'add_channel');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error in channels command', { error, userId });
    await ctx.reply('❌ Произошла ошибка при получении списка каналов');
  }
}
