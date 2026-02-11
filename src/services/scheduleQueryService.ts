/**
 * Schedule query service - complex queries for calendar view
 */

import { prisma } from '../utils/db.js';
import { PostStatus } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, eachDayOfInterval } from 'date-fns';
import { logger } from '../utils/logger.js';

export interface ScheduleFilters {
  channelId?: number;
  status?: PostStatus;
}

export interface DaySchedule {
  date: Date;
  posts: any[];
  count: number;
}

export interface WeekSchedule {
  startDate: Date;
  endDate: Date;
  days: DaySchedule[];
  totalPosts: number;
}

export interface MonthSchedule {
  year: number;
  month: number;
  days: Map<string, number>; // date string -> count
  totalPosts: number;
}

/**
 * Get posts for a specific day
 */
export async function getPostsForDay(date: Date, filters?: ScheduleFilters) {
  try {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const where: any = {
      status: PostStatus.SCHEDULED,
      schedule: {
        scheduled_at: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    };

    if (filters?.channelId) {
      where.channel_id = filters.channelId;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        channel: true,
        schedule: true,
        media: { orderBy: { position: 'asc' } },
        buttons: { orderBy: [{ row: 'asc' }, { position: 'asc' }] },
      },
      orderBy: {
        schedule: {
          scheduled_at: 'asc',
        },
      },
    });

    return posts;
  } catch (error) {
    logger.error('Error getting posts for day', { error, date });
    return [];
  }
}

/**
 * Get schedule for a week
 */
export async function getWeekSchedule(date: Date, filters?: ScheduleFilters): Promise<WeekSchedule> {
  try {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    const days: DaySchedule[] = [];
    let totalPosts = 0;

    // Get posts for each day
    const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    for (const day of allDays) {
      const posts = await getPostsForDay(day, filters);
      days.push({
        date: day,
        posts,
        count: posts.length,
      });
      totalPosts += posts.length;
    }

    return {
      startDate: weekStart,
      endDate: weekEnd,
      days,
      totalPosts,
    };
  } catch (error) {
    logger.error('Error getting week schedule', { error, date });
    return {
      startDate: date,
      endDate: date,
      days: [],
      totalPosts: 0,
    };
  }
}

/**
 * Get schedule for a month (counts only, for calendar overlay)
 */
export async function getMonthSchedule(date: Date, filters?: ScheduleFilters): Promise<MonthSchedule> {
  try {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const where: any = {
      status: PostStatus.SCHEDULED,
      schedule: {
        scheduled_at: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    };

    if (filters?.channelId) {
      where.channel_id = filters.channelId;
    }

    // Get all scheduled posts for the month
    const posts = await prisma.post.findMany({
      where,
      include: {
        schedule: true,
      },
    });

    // Group by day
    const dayCounts = new Map<string, number>();
    let totalPosts = 0;

    posts.forEach(post => {
      if (post.schedule?.scheduled_at) {
        const dayKey = startOfDay(post.schedule.scheduled_at).toISOString();
        dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
        totalPosts++;
      }
    });

    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      days: dayCounts,
      totalPosts,
    };
  } catch (error) {
    logger.error('Error getting month schedule', { error, date });
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      days: new Map(),
      totalPosts: 0,
    };
  }
}

/**
 * Get posts in a date range
 */
export async function getPostsInRange(startDate: Date, endDate: Date, filters?: ScheduleFilters) {
  try {
    const where: any = {
      status: PostStatus.SCHEDULED,
      schedule: {
        scheduled_at: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
    };

    if (filters?.channelId) {
      where.channel_id = filters.channelId;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        channel: true,
        schedule: true,
        media: { orderBy: { position: 'asc' } },
        buttons: { orderBy: [{ row: 'asc' }, { position: 'asc' }] },
      },
      orderBy: {
        schedule: {
          scheduled_at: 'asc',
        },
      },
    });

    return posts;
  } catch (error) {
    logger.error('Error getting posts in range', { error, startDate, endDate });
    return [];
  }
}

/**
 * Get upcoming posts (next N posts)
 */
export async function getUpcomingPosts(limit: number = 10, filters?: ScheduleFilters) {
  try {
    const now = new Date();

    const where: any = {
      status: PostStatus.SCHEDULED,
      schedule: {
        scheduled_at: {
          gte: now,
        },
      },
    };

    if (filters?.channelId) {
      where.channel_id = filters.channelId;
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        channel: true,
        schedule: true,
      },
      orderBy: {
        schedule: {
          scheduled_at: 'asc',
        },
      },
      take: limit,
    });

    return posts;
  } catch (error) {
    logger.error('Error getting upcoming posts', { error });
    return [];
  }
}
