/**
 * Channel service - business logic for channel management
 */
import { prisma } from '../utils/db.js';
import { Channel } from '@prisma/client';
import { logger } from '../utils/logger.js';

/**
 * Add a new channel
 */
export async function addChannel(
  channelId: bigint,
  channelTitle: string,
  channelUsername?: string
): Promise<Channel> {
  try {
    const channel = await prisma.channel.create({
      data: {
        channel_id: channelId,
        channel_title: channelTitle,
        channel_username: channelUsername,
        is_active: true,
      },
    });

    logger.info('Channel added', { channelId: channel.id });
    return channel;
  } catch (error) {
    logger.error('Failed to add channel', { error, channelId });
    throw new Error('Не удалось добавить канал');
  }
}

/**
 * Get all active channels
 */
export async function getActiveChannels(): Promise<Channel[]> {
  try {
    return await prisma.channel.findMany({
      where: { is_active: true },
      orderBy: { date_added: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to get active channels', { error });
    return [];
  }
}

/**
 * Get channel by ID
 */
export async function getChannelById(id: number): Promise<Channel | null> {
  try {
    return await prisma.channel.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Failed to get channel', { error, id });
    return null;
  }
}

/**
 * Deactivate channel (soft delete)
 */
export async function deactivateChannel(id: number): Promise<void> {
  try {
    await prisma.channel.update({
      where: { id },
      data: { is_active: false },
    });

    logger.info('Channel deactivated', { channelId: id });
  } catch (error) {
    logger.error('Failed to deactivate channel', { error, id });
    throw new Error('Не удалось деактивировать канал');
  }
}

/**
 * Update channel info
 */
export async function updateChannel(
  id: number,
  channelTitle?: string,
  channelUsername?: string
): Promise<Channel> {
  try {
    const channel = await prisma.channel.update({
      where: { id },
      data: {
        ...(channelTitle && { channel_title: channelTitle }),
        ...(channelUsername && { channel_username: channelUsername }),
      },
    });

    logger.info('Channel updated', { channelId: id });
    return channel;
  } catch (error) {
    logger.error('Failed to update channel', { error, id });
    throw new Error('Не удалось обновить информацию о канале');
  }
}
