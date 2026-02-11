/**
 * Pagination keyboard builder for lists
 */

import { InlineKeyboard } from 'grammy';
import { buildPaginationCallback } from '../utils/callbackData.js';

/**
 * Pagination options
 */
export interface PaginationOptions {
  currentPage: number;
  totalPages: number;
  dataPrefix: string; // e.g., 'ep' for editpost, 'dr' for drafts
}

/**
 * Add pagination buttons to existing keyboard
 */
export function addPaginationButtons(
  keyboard: InlineKeyboard,
  options: PaginationOptions
): InlineKeyboard {
  const { currentPage, totalPages, dataPrefix } = options;

  if (totalPages <= 1) {
    // No pagination needed
    return keyboard;
  }

  // Create new row for pagination
  keyboard.row();

  // Previous button
  if (currentPage > 1) {
    const prevCallback = buildPaginationCallback(currentPage - 1, dataPrefix);
    keyboard.text('◀️ Пред', prevCallback);
  }

  // Page indicator (non-clickable)
  keyboard.text(`${currentPage}/${totalPages}`, `${dataPrefix}_pg_info`);

  // Next button
  if (currentPage < totalPages) {
    const nextCallback = buildPaginationCallback(currentPage + 1, dataPrefix);
    keyboard.text('След ▶️', nextCallback);
  }

  return keyboard;
}

/**
 * Build standalone pagination keyboard
 */
export function buildPaginationKeyboard(
  options: PaginationOptions
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  return addPaginationButtons(keyboard, options);
}

/**
 * Calculate pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  totalPages: number;
  startIndex: number;  // For array slicing
  endIndex: number;    // For array slicing
  hasPrev: boolean;    // Whether there's a previous page
  hasNext: boolean;    // Whether there's a next page
  currentPage: number; // Alias for page
}

/**
 * Calculate pagination parameters for database queries
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number = 1,
  itemsPerPage: number = 5
): PaginationParams {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const offset = (page - 1) * itemsPerPage;
  const startIndex = offset;
  const endIndex = Math.min(offset + itemsPerPage, totalItems);

  return {
    page,
    limit: itemsPerPage,
    offset,
    totalPages,
    startIndex,
    endIndex,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    currentPage: page,
  };
}
