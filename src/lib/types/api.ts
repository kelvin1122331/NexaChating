import { z } from 'zod';

/** Validated JSON message-send body accepted by the authenticated API. */
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(20_000),
  replyToId: z.string().uuid().nullable().optional(),
  clientMessageId: z.string().uuid().optional(),
}).strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Stable error envelope returned by NexaChat API routes. */
export interface ApiError {
  error: string;
  code?: string;
}
