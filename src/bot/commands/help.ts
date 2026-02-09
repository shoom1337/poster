/**
 * /help command handler
 */
import { CommandContext } from 'grammy';
import { logger } from '../../utils/logger.js';

export async function helpCommand(ctx: CommandContext<any>) {
  const userId = ctx.from?.id;
  logger.info('Help command', { userId });

  const message =
    '📚 **Справка по командам**\n\n' +
    '**Управление публикациями:**\n' +
    '/newpost - Создать новую публикацию\n' +
    '/editpost - Редактировать публикацию\n' +
    '/drafts - Список черновиков\n' +
    '/schedule - Календарь публикаций\n\n' +
    '**Аналитика:**\n' +
    '/statistics - Статистика по всем постам\n\n' +
    '**Настройки:**\n' +
    '/channels - Управление каналами\n\n' +
    '**Другое:**\n' +
    '/cancel - Отменить текущее действие\n' +
    '/help - Показать эту справку\n\n' +
    '💡 Для создания публикации используйте /newpost';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
