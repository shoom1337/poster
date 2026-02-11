/**
 * Custom context type for the bot
 */

import { Context as GrammyContext, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { SessionData } from './session.js';

/**
 * Custom context type that includes session and conversation flavors
 */
export type MyContext = GrammyContext & SessionFlavor<SessionData> & ConversationFlavor;
