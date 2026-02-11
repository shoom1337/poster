/**
 * Calendar keyboard builder using telegram-inline-calendar
 */

import { InlineKeyboard } from 'grammy';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  getDay,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { buildCalendarCallback } from '../utils/callbackData.js';

/**
 * Build calendar keyboard for date selection
 */
export function buildCalendarKeyboard(currentDate: Date = new Date()): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Header with month and year
  const monthYear = format(currentDate, 'LLLL yyyy', { locale: ru });
  keyboard.text(monthYear, 'cal_ignore').row();

  // Week day headers
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  weekDays.forEach(day => {
    keyboard.text(day, 'cal_ignore');
  });
  keyboard.row();

  // Get all days in month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get starting day of week (0 = Sunday, 1 = Monday, etc.)
  const startDay = getDay(monthStart);
  // Adjust to Monday = 0
  const startDayAdjusted = startDay === 0 ? 6 : startDay - 1;

  // Add empty cells for days before month starts
  for (let i = 0; i < startDayAdjusted; i++) {
    keyboard.text(' ', 'cal_ignore');
  }

  // Add day buttons
  const today = startOfDay(new Date());

  daysInMonth.forEach((day, index) => {
    const dayNum = format(day, 'd');
    const dayStart = startOfDay(day);

    // Check if day is in the past
    const isPast = isBefore(dayStart, today);

    if (isPast) {
      // Past dates are not selectable
      keyboard.text(dayNum, 'cal_ignore');
    } else {
      // Future dates are selectable
      const callback = buildCalendarCallback(day);
      const displayText = isToday(day) ? `[${dayNum}]` : dayNum;
      keyboard.text(displayText, callback);
    }

    // New row after Sunday
    if ((startDayAdjusted + index + 1) % 7 === 0) {
      keyboard.row();
    }
  });

  // Navigation buttons
  keyboard.row();
  keyboard
    .text('◀️ Пред', `cal_prev_${format(subMonths(currentDate, 1), 'yyyy-MM')}`)
    .text('След ▶️', `cal_next_${format(addMonths(currentDate, 1), 'yyyy-MM')}`);

  return keyboard;
}

/**
 * Parse calendar date callback (e.g., "cal_20260210" -> Date object)
 */
export function parseCalendarDate(data: string): Date | null {
  const match = data.match(/^cal_(\d{8})$/);
  if (!match) return null;

  const dateStr = match[1]; // "20260210"
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);

  return new Date(year, month, day);
}

/**
 * Parse month navigation callback
 */
export function parseMonthNavigation(data: string): Date | null {
  const match = data.match(/^cal_(prev|next)_(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[2], 10);
  const month = parseInt(match[3], 10) - 1; // JavaScript months are 0-indexed

  return new Date(year, month, 1);
}
