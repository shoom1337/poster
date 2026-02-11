/**
 * Session data types for bot conversation state
 */

import { PostStatus, MediaType } from '@prisma/client';

/**
 * Media file stored in session during post creation/editing
 */
export interface SessionMediaFile {
  fileId: string;
  fileType: MediaType;
  fileSize?: number;
  caption?: string;
  position: number;
}

/**
 * Button stored in session during post creation/editing
 */
export interface SessionButton {
  text: string;
  url: string;
  row: number;
  position: number;
}

/**
 * Post draft data stored in session
 */
export interface PostDraft {
  id?: number;              // For editing existing posts
  channelId?: number;
  text?: string;
  mediaFiles?: SessionMediaFile[];
  buttons?: SessionButton[];
  scheduledAt?: Date;
  status?: PostStatus;
  step?: 'channel' | 'text' | 'media' | 'buttons' | 'time' | 'preview';
}

/**
 * Schedule view state for calendar navigation
 */
export interface ScheduleView {
  mode: 'days' | 'weeks' | 'months';
  currentDate: Date;
  filters?: {
    channelId?: number;
    status?: PostStatus;
  };
}

/**
 * Pagination state for lists
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  entity: 'posts' | 'drafts' | 'channels';
}

/**
 * Awaiting input state for hybrid text/media input flow
 */
export interface AwaitingInput {
  type: 'text' | 'media' | 'button';
  messageId: number;        // ID of the message to edit after input received
}

/**
 * Main session data structure
 */
export interface SessionData {
  // Current operation context
  currentOperation?: 'newpost' | 'editpost' | 'schedule' | 'drafts';

  // Post creation/editing state
  postDraft?: PostDraft;

  // Schedule view state
  scheduleView?: ScheduleView;

  // Pagination state
  pagination?: PaginationState;

  // Temporary state for awaiting user input
  awaitingInput?: AwaitingInput;
}
