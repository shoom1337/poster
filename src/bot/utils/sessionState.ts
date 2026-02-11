/**
 * Session state management helpers
 */

import { logger } from '../../utils/logger.js';
import { MyContext } from '../../types/context.js';
import {
  SessionData,
  PostDraft,
  ScheduleView,
  PaginationState,
  AwaitingInput,
} from '../../types/session.js';

/**
 * Get full session data
 */
export function getSessionState(ctx: MyContext): SessionData {
  return ctx.session || {};
}

/**
 * Update session state with partial data
 */
export function updateSessionState(
  ctx: MyContext,
  updates: Partial<SessionData>
): void {
  ctx.session = { ...ctx.session, ...updates };
}

/**
 * Clear entire session state
 */
export function clearSessionState(ctx: MyContext): void {
  ctx.session = {};
}

/**
 * Get post draft from session
 */
export function getPostDraft(ctx: MyContext): PostDraft | undefined {
  return ctx.session?.postDraft;
}

/**
 * Update post draft with partial data
 */
export function updatePostDraft(ctx: MyContext, updates: Partial<PostDraft>): void {
  ctx.session = {
    ...ctx.session,
    postDraft: { ...ctx.session?.postDraft, ...updates },
  };
}

/**
 * Clear post draft from session
 */
export function clearPostDraft(ctx: MyContext): void {
  if (ctx.session) {
    delete ctx.session.postDraft;
    delete ctx.session.awaitingInput;
    delete ctx.session.currentOperation;
  }
}

/**
 * Get schedule view state
 */
export function getScheduleView(ctx: MyContext): ScheduleView | undefined {
  return ctx.session?.scheduleView;
}

/**
 * Update schedule view state
 */
export function updateScheduleView(
  ctx: MyContext,
  updates: Partial<ScheduleView>
): void {
  ctx.session = {
    ...ctx.session,
    scheduleView: { ...ctx.session?.scheduleView, ...updates } as ScheduleView,
  };
}

/**
 * Clear schedule view from session
 */
export function clearScheduleView(ctx: MyContext): void {
  if (ctx.session) {
    delete ctx.session.scheduleView;
  }
}

/**
 * Get pagination state
 */
export function getPagination(ctx: MyContext): PaginationState | undefined {
  return ctx.session?.pagination;
}

/**
 * Update pagination state
 */
export function updatePagination(
  ctx: MyContext,
  updates: Partial<PaginationState>
): void {
  ctx.session = {
    ...ctx.session,
    pagination: { ...ctx.session?.pagination, ...updates } as PaginationState,
  };
}

/**
 * Clear pagination from session
 */
export function clearPagination(ctx: MyContext): void {
  if (ctx.session) {
    delete ctx.session.pagination;
  }
}

/**
 * Get awaiting input state
 */
export function getAwaitingInput(ctx: MyContext): AwaitingInput | undefined {
  const result = ctx.session?.awaitingInput;
  logger.debug('getAwaitingInput called', {
    userId: ctx.from?.id,
    hasSession: !!ctx.session,
    hasAwaitingInput: !!result,
    awaitingType: result?.type,
  });
  return result;
}

/**
 * Set awaiting input state
 */
export function setAwaitingInput(
  ctx: MyContext,
  input: AwaitingInput
): void {
  logger.info('setAwaitingInput called', {
    userId: ctx.from?.id,
    inputType: input.type,
    messageId: input.messageId,
    sessionBefore: JSON.stringify(ctx.session),
  });

  updateSessionState(ctx, { awaitingInput: input });

  logger.info('setAwaitingInput completed', {
    userId: ctx.from?.id,
    sessionAfter: JSON.stringify(ctx.session),
    awaitingInput: JSON.stringify(ctx.session?.awaitingInput),
  });
}

/**
 * Clear awaiting input state
 */
export function clearAwaitingInput(ctx: MyContext): void {
  if (ctx.session) {
    delete ctx.session.awaitingInput;
  }
}

/**
 * Check if session has active operation
 */
export function hasActiveOperation(ctx: MyContext): boolean {
  return !!ctx.session?.currentOperation;
}

/**
 * Get current operation
 */
export function getCurrentOperation(ctx: MyContext): string | undefined {
  return ctx.session?.currentOperation;
}

/**
 * Set current operation
 */
export function setCurrentOperation(
  ctx: MyContext,
  operation: 'newpost' | 'editpost' | 'schedule' | 'drafts'
): void {
  updateSessionState(ctx, { currentOperation: operation });
}

/**
 * Clear current operation
 */
export function clearCurrentOperation(ctx: MyContext): void {
  if (ctx.session) {
    delete ctx.session.currentOperation;
  }
}
