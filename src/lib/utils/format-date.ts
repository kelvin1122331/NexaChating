import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';

/** Formats a conversation timestamp in the compact style used in the inbox. */
export function formatConversationTime(value: string): string {
  const date = parseISO(value);
  if (isToday(date)) return format(date, 'h:mm a').toLowerCase();
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEE');
  return format(date, 'MMM d');
}

/** Gives a human-friendly day label to messages and conversation headers. */
export function formatDayLabel(value: string): string {
  const date = parseISO(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

/** Formats a chat timestamp without leading zeroes. */
export function formatMessageTime(value: string): string {
  return format(parseISO(value), 'h:mm a').toLowerCase();
}

/** Returns a short relative date phrase for task cards. */
export function formatTaskDueDate(value?: string): string {
  if (!value) return 'No due date';
  const date = parseISO(`${value}T12:00:00`);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}
