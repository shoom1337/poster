/**
 * Callback data encoding/decoding utilities
 * Telegram limits callback data to 64 bytes
 */

/**
 * Callback action prefixes
 */
export const CallbackPrefix = {
  // New post actions
  NEW_POST: 'np',
  NEW_POST_CHANNEL: 'np_ch',
  NEW_POST_TEXT: 'np_txt',
  NEW_POST_MEDIA: 'np_med',
  NEW_POST_MEDIA_ADD: 'np_med_add',
  NEW_POST_MEDIA_DONE: 'np_med_done',
  NEW_POST_BUTTON: 'np_btn',
  NEW_POST_BUTTON_ADD: 'np_btn_add',
  NEW_POST_BUTTON_DONE: 'np_btn_done',
  NEW_POST_TIME: 'np_tim',
  NEW_POST_TIME_NOW: 'np_tim_now',
  NEW_POST_TIME_SCHEDULE: 'np_tim_sch',
  NEW_POST_TIME_DRAFT: 'np_tim_drf',
  NEW_POST_TIME_TEST: 'np_tim_tst',
  NEW_POST_PREVIEW: 'np_prv',
  NEW_POST_CONFIRM: 'np_cnf',
  NEW_POST_CANCEL: 'np_cnl',
  NEW_POST_BACK: 'np_bck',

  // Edit post actions
  EDIT_POST: 'ep',
  EDIT_POST_PAGE: 'ep_pg',
  EDIT_POST_CHANNEL: 'ep_ch',
  EDIT_POST_TEXT: 'ep_txt',
  EDIT_POST_MEDIA: 'ep_med',
  EDIT_POST_MEDIA_ADD: 'ep_med_add',
  EDIT_POST_MEDIA_DONE: 'ep_med_done',
  EDIT_POST_MEDIA_CLEAR: 'ep_med_clr',
  EDIT_POST_BUTTONS: 'ep_btn',
  EDIT_POST_BUTTON_ADD: 'ep_btn_add',
  EDIT_POST_BUTTON_DONE: 'ep_btn_done',
  EDIT_POST_BUTTON_CLEAR: 'ep_btn_clr',
  EDIT_POST_TIME: 'ep_tim',
  EDIT_POST_PREVIEW: 'ep_prv',
  EDIT_POST_SAVE: 'ep_sav',
  EDIT_POST_CANCEL: 'ep_cnl',
  EDIT_POST_BACK: 'ep_bck',

  // Schedule actions
  SCHEDULE: 'sch',
  SCHEDULE_DAYS: 'sch_d',
  SCHEDULE_WEEKS: 'sch_w',
  SCHEDULE_MONTHS: 'sch_m',
  SCHEDULE_FILTERS: 'sch_f',
  SCHEDULE_POST: 'sch_p',
  SCHEDULE_POST_EDIT: 'sch_p_ed',
  SCHEDULE_POST_RESCHEDULE: 'sch_p_rs',
  SCHEDULE_POST_DUPLICATE: 'sch_p_dup',
  SCHEDULE_POST_DELETE: 'sch_p_del',
  SCHEDULE_BACK: 'sch_bck',

  // Drafts actions
  DRAFT: 'dr',
  DRAFT_EDIT: 'dr_ed',
  DRAFT_DELETE: 'dr_del',

  // Calendar actions
  CALENDAR: 'cal',
  CALENDAR_PREV: 'cal_prv',
  CALENDAR_NEXT: 'cal_nxt',

  // Time picker actions
  TIME: 'tim',
  TIME_HOUR: 'tim',
  TIME_MINUTE: 'min',
  TIME_BACK: 'tim_bck',

  // Pagination
  PAGE: 'pg',
} as const;

/**
 * Build callback data for channel selection
 */
export function buildChannelCallback(channelId: number, prefix: string = CallbackPrefix.NEW_POST_CHANNEL): string {
  return `${prefix}_${channelId}`;
}

/**
 * Build callback data for post action
 */
export function buildPostCallback(postId: number, action: string): string {
  return `${action}_${postId}`;
}

/**
 * Build callback data for post status (edit/delete)
 */
export function buildPostStatusCallback(action: 'edit' | 'delete', postId: number): string {
  return `${CallbackPrefix.EDIT_POST}_${action}_${postId}`;
}

/**
 * Build callback data for schedule post action
 */
export function buildSchedulePostCallback(postId: number, action: string): string {
  return `sch_p_${postId}_${action}`;
}

/**
 * Build callback data for time selection
 */
export function buildTimeCallback(hour: number): string {
  return `${CallbackPrefix.TIME}_${hour}`;
}

/**
 * Build callback data for minute selection
 */
export function buildMinuteCallback(minute: number): string {
  return `${CallbackPrefix.TIME_MINUTE}_${minute}`;
}

/**
 * Build callback data for calendar date
 */
export function buildCalendarCallback(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${CallbackPrefix.CALENDAR}_${year}${month}${day}`;
}

/**
 * Build callback data for pagination
 */
export function buildPaginationCallback(page: number, prefix: string): string {
  return `${prefix}_${CallbackPrefix.PAGE}_${page}`;
}

/**
 * Parse channel ID from callback data
 */
export function parseChannelId(data: string): number | null {
  const match = data.match(/_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse post ID from callback data
 */
export function parsePostId(data: string): number | null {
  const match = data.match(/_(\d+)(?:_|$)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse hour from time callback
 */
export function parseHour(data: string): number | null {
  const match = data.match(/^tim_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse minute from time callback
 */
export function parseMinute(data: string): number | null {
  const match = data.match(/^min_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Parse date from calendar callback
 */
export function parseCalendarDate(data: string): Date | null {
  const match = data.match(/^cal_(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(match[3], 10);

  return new Date(year, month, day);
}

/**
 * Parse page number from pagination callback
 */
export function parsePage(data: string): number | null {
  const match = data.match(/_pg_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if callback data matches prefix
 */
export function matchesPrefix(data: string, prefix: string): boolean {
  return data.startsWith(prefix);
}

/**
 * Extract action from callback data
 */
export function extractAction(data: string): string {
  const parts = data.split('_');
  return parts.length > 1 ? parts.slice(0, -1).join('_') : data;
}
