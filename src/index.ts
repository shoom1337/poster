/**
 * Poster Bot - Telegram bot for managing scheduled posts
 */
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { parseMode } from '@grammyjs/parse-mode';
import { logger } from './utils/logger.js';
import { checkDatabaseConnection, disconnectDatabase } from './utils/db.js';
import { checkRedisConnection, disconnectRedis, redis } from './utils/redis.js';
import { authMiddleware } from './bot/middlewares/auth.js';
import { loggingMiddleware, errorMiddleware } from './bot/middlewares/logging.js';
import { startCommand } from './bot/commands/start.js';
import { helpCommand } from './bot/commands/help.js';
import { channelsCommand } from './bot/commands/channels.js';
import { addChannel } from './services/channelService.js';
import http from 'http';

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const HEALTHCHECK_PORT = Number(process.env.HEALTHCHECK_PORT) || 3000;

if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

// Create bot instance
const bot = new Bot(BOT_TOKEN);

// Install parse mode plugin
bot.api.config.use(parseMode('HTML'));

// Error handling middleware (first)
bot.use(errorMiddleware);

// Logging middleware
bot.use(loggingMiddleware);

// Authorization middleware
bot.use(authMiddleware);

// Session for conversations
bot.use(session({
  initial: () => ({}),
  storage: {
    async read(key: string) {
      const data = await redis.get(`session:${key}`);
      return data ? JSON.parse(data) : undefined;
    },
    async write(key: string, value: any) {
      await redis.set(`session:${key}`, JSON.stringify(value), 'EX', 3600);
    },
    async delete(key: string) {
      await redis.del(`session:${key}`);
    },
  },
}));

// Install conversations plugin
bot.use(conversations());

// Register commands
bot.command('start', startCommand);
bot.command('help', helpCommand);
bot.command('channels', channelsCommand);

// Placeholder commands (to be implemented)
bot.command('newpost', async (ctx) => {
  await ctx.reply(
    '📝 Создание публикации\n\n' +
    'Эта функция будет доступна в следующей версии.\n' +
    'Используйте /help для просмотра доступных команд.'
  );
});

bot.command('drafts', async (ctx) => {
  await ctx.reply(
    '📋 Список черновиков\n\n' +
    'У вас пока нет черновиков.'
  );
});

bot.command('schedule', async (ctx) => {
  await ctx.reply(
    '📅 Календарь публикаций\n\n' +
    'Эта функция будет доступна в следующей версии.'
  );
});

bot.command('statistics', async (ctx) => {
  await ctx.reply(
    '📊 Статистика\n\n' +
    'Эта функция будет доступна в следующей версии.'
  );
});

bot.command('cancel', async (ctx) => {
  await ctx.reply('✅ Текущее действие отменено');
});

// Handle callback queries
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data === 'add_channel') {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      'Для добавления канала:\n' +
      '1. Добавьте бота в канал как администратора\n' +
      '2. Перешлите любое сообщение из канала сюда'
    );
    return;
  }

  await ctx.answerCallbackQuery('Функция в разработке');
});

// Handle forwarded messages from channels
bot.on(':forward_origin:channel', async (ctx) => {
  try {
    const forwardOrigin = ctx.message?.forward_origin;

    if (forwardOrigin?.type !== 'channel') {
      return;
    }

    const channelId = forwardOrigin.chat.id;
    const channelTitle = forwardOrigin.chat.title;
    const channelUsername = forwardOrigin.chat.username;

    logger.info('Processing forwarded channel message', {
      channelId,
      channelTitle,
      channelUsername,
      userId: ctx.from?.id,
    });

    // Try to get bot info in the channel to verify it's an admin
    try {
      const botMember = await ctx.api.getChatMember(channelId.toString(), ctx.me.id);

      if (botMember.status !== 'administrator') {
        await ctx.reply(
          '❌ Ошибка: бот не является администратором канала.\n\n' +
          'Пожалуйста, добавьте бота в канал как администратора и попробуйте снова.'
        );
        return;
      }
    } catch (error) {
      logger.error('Failed to check bot admin status', { error, channelId });
      await ctx.reply(
        '❌ Не удалось проверить права бота в канале.\n\n' +
        'Убедитесь, что бот добавлен в канал как администратор.'
      );
      return;
    }

    // Add channel to database
    try {
      await addChannel(channelId, channelTitle, channelUsername);

      await ctx.reply(
        `✅ Канал успешно добавлен!\n\n` +
        `📢 ${channelTitle}\n` +
        `ID: \`${channelId}\`\n` +
        (channelUsername ? `Username: @${channelUsername}\n` : '') +
        `\nТеперь вы можете публиковать посты в этот канал.\n` +
        `Используйте /channels для управления каналами.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Failed to add channel', { error, channelId });

      // Check if it's a duplicate
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        await ctx.reply(
          '⚠️ Этот канал уже добавлен.\n\n' +
          'Используйте /channels для просмотра списка каналов.'
        );
      } else {
        await ctx.reply(
          '❌ Не удалось добавить канал. Попробуйте еще раз позже.'
        );
      }
    }
  } catch (error) {
    logger.error('Error handling forwarded message', { error, userId: ctx.from?.id });
    await ctx.reply(
      '❌ Произошла ошибка при обработке сообщения.'
    );
  }
});

// Healthcheck HTTP server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop bot
    await bot.stop();
    logger.info('Bot stopped');

    // Close HTTP server
    healthServer.close(() => {
      logger.info('Healthcheck server closed');
    });

    // Disconnect from database
    await disconnectDatabase();

    // Disconnect from Redis
    await disconnectRedis();

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start bot
async function start() {
  try {
    logger.info('Starting Poster Bot...');

    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Check Redis connection
    const redisConnected = await checkRedisConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed, conversations will be stored in memory');
    }

    // Start healthcheck server
    healthServer.listen(HEALTHCHECK_PORT, () => {
      logger.info(`Healthcheck server listening on port ${HEALTHCHECK_PORT}`);
    });

    // Start bot with long polling
    logger.info('Starting bot with long polling...');
    await bot.start({
      onStart: (botInfo) => {
        logger.info('Bot started successfully', {
          username: botInfo.username,
          id: botInfo.id,
        });
      },
    });
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

// Run
start();
