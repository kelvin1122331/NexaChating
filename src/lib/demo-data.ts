import type { ChatMessage } from '@/lib/types/message';
import type { ConversationSummary } from '@/lib/types/conversation';
import type { UserProfile } from '@/lib/types/user';

interface DemoConversationMember {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: null;
  isOnline: boolean;
  role: 'owner' | 'admin' | 'member';
  initials: string;
  color: string;
}

const today = (hour: number, minute = 0): string =>
  new Date(Date.UTC(2026, 9, 13, hour, minute)).toISOString();
const yesterday = (hour: number, minute = 0): string =>
  new Date(Date.UTC(2026, 9, 12, hour, minute)).toISOString();

export const demoUser: UserProfile = {
  id: 'me',
  displayName: 'Alex Morgan',
  username: 'alexmorgan',
  email: 'alex@nexachat.app',
  avatarUrl: null,
  bio: 'Building good things with good people.',
  statusText: 'Available',
  isOnline: true,
  isVerified: true,
  accountType: 'personal',
  locale: 'en',
  theme: 'light',
};

const member = (
  id: string,
  displayName: string,
  username: string,
  initials: string,
  color: string,
  role: 'owner' | 'admin' | 'member' = 'member',
): DemoConversationMember => ({ id, displayName, username, avatarUrl: null, isOnline: false, role, initials, color });

export const demoConversations: ConversationSummary[] = [
  {
    id: 'olivia', type: 'personal', title: 'Olivia Chen', subtitle: 'Product designer', avatarUrl: null,
    avatarColor: 'from-rose-300 to-orange-200', initials: 'OC', lastMessage: 'That looks amazing! Let’s ship it 🚀',
    lastMessageAt: today(10, 42), unreadCount: 2, isOnline: true, isMuted: false, isPinned: true,
    isArchived: false, isTyping: false,
    members: [member('olivia-user', 'Olivia Chen', 'oliviachen', 'OC', 'rose')], tags: ['personal'],
  },
  {
    id: 'product-design', type: 'group', title: 'Product Design', subtitle: '8 members', avatarUrl: null,
    avatarColor: 'from-violet-300 to-indigo-200', initials: 'PD',
    lastMessage: 'Sam: Dropped the new explorations in Figma', lastMessageAt: today(10, 18), unreadCount: 4,
    isOnline: false, isMuted: false, isPinned: true, isArchived: false, isTyping: false,
    members: [member('sam', 'Sam Rivera', 'samrivera', 'SR', 'violet', 'admin'), member('olivia-user', 'Olivia Chen', 'oliviachen', 'OC', 'rose')], tags: ['work'],
  },
  {
    id: 'marcus', type: 'personal', title: 'Marcus Reed', subtitle: 'Last seen 8 min ago', avatarUrl: null,
    avatarColor: 'from-sky-300 to-cyan-200', initials: 'MR', lastMessage: 'Voice message · 0:18',
    lastMessageAt: today(9, 56), unreadCount: 0, isOnline: false, isMuted: false, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('marcus-user', 'Marcus Reed', 'marcusreed', 'MR', 'sky')], tags: ['personal'],
  },
  {
    id: 'nexa-ai', type: 'personal', title: 'Nexa AI', subtitle: 'Your thoughtful assistant', avatarUrl: null,
    avatarColor: 'from-indigo-500 to-violet-500', initials: '✦', lastMessage: 'I found three helpful ideas for you.',
    lastMessageAt: today(9, 21), unreadCount: 0, isOnline: true, isMuted: false, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('nexa-ai-user', 'Nexa AI', 'nexaai', '✦', 'indigo')], tags: ['ai_tools'],
  },
  {
    id: 'weekend-hikers', type: 'group', title: 'Weekend hikers', subtitle: '12 members', avatarUrl: null,
    avatarColor: 'from-emerald-300 to-lime-200', initials: 'WH', lastMessage: 'You: I’m in! 🥾',
    lastMessageAt: yesterday(18, 34), unreadCount: 0, isOnline: false, isMuted: true, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('leo', 'Leo Grant', 'leogrant', 'LG', 'green'), member('maya', 'Maya Park', 'mayapark', 'MP', 'amber')], tags: ['community'],
  },
  {
    id: 'launch-channel', type: 'channel', title: 'Nexa launch notes', subtitle: '1.2k subscribers', avatarUrl: null,
    avatarColor: 'from-amber-300 to-yellow-200', initials: 'NL', lastMessage: 'A little preview of what’s next ✨',
    lastMessageAt: yesterday(15, 2), unreadCount: 1, isOnline: false, isMuted: false, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('channel-owner', 'Nexa team', 'nexateam', 'NT', 'amber', 'owner')], tags: ['community'],
  },
  {
    id: 'mom', type: 'personal', title: 'Mom', subtitle: 'online', avatarUrl: null,
    avatarColor: 'from-pink-300 to-rose-200', initials: 'M', lastMessage: 'Don’t forget to call Nana 💛',
    lastMessageAt: yesterday(12, 15), unreadCount: 0, isOnline: true, isMuted: false, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('mom-user', 'Mom', 'mom', 'M', 'pink')], tags: ['personal', 'family'],
  },
  {
    id: 'dana', type: 'personal', title: 'Dana Brooks', subtitle: 'Account manager', avatarUrl: null,
    avatarColor: 'from-orange-300 to-amber-200', initials: 'DB', lastMessage: 'Perfect, thanks for the update!',
    lastMessageAt: yesterday(10, 5), unreadCount: 0, isOnline: false, isMuted: false, isPinned: false,
    isArchived: false, isTyping: false,
    members: [member('dana-user', 'Dana Brooks', 'danabrooks', 'DB', 'orange')], tags: ['work'],
  },
];

const makeMessage = (
  id: string,
  conversationId: string,
  senderId: string,
  senderName: string,
  senderInitials: string,
  content: string,
  createdAt: string,
  status: ChatMessage['status'] = 'read',
  extras: Partial<ChatMessage> = {},
): ChatMessage => ({
  id, conversationId, senderId, senderName, senderInitials, content, createdAt,
  type: 'text', status, isEdited: false, isStarred: false, isDeleted: false, reactions: [], ...extras,
});

export const demoMessages: Record<string, ChatMessage[]> = {
  olivia: [
    makeMessage('o-1', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'Hey Alex! How did the client review go?', yesterday(15, 20)),
    makeMessage('o-2', 'olivia', 'me', 'Alex Morgan', 'AM', 'Really well. They loved the direction, especially the new onboarding flow.', yesterday(15, 22)),
    makeMessage('o-3', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'I had a feeling they would! 🎉', yesterday(15, 25)),
    makeMessage('o-4', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'Did you get a chance to look at the updated dashboard?', yesterday(15, 26)),
    makeMessage('o-5', 'olivia', 'me', 'Alex Morgan', 'AM', 'Just opened it. The spacing feels much better now.', yesterday(15, 31)),
    makeMessage('o-6', 'olivia', 'me', 'Alex Morgan', 'AM', 'I left a few notes on the activity cards — nothing major.', yesterday(15, 32)),
    makeMessage('o-7', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'Amazing, I’ll take a look after lunch.', yesterday(15, 35)),
    makeMessage('o-8', 'olivia', 'me', 'Alex Morgan', 'AM', 'Morning! I added those notes to the handoff doc too.', today(9, 4)),
    makeMessage('o-9', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'Good morning ☀️ Thanks, that makes things easier.', today(9, 8)),
    makeMessage('o-10', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'For the empty state, I’m thinking something warm and helpful — less “nothing here”, more “your next great idea starts here”.', today(9, 12)),
    makeMessage('o-11', 'olivia', 'me', 'Alex Morgan', 'AM', 'Yes! Love that. It feels a lot more human.', today(9, 19)),
    makeMessage('o-12', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'Here’s a little visual direction I put together', today(9, 22), 'read', {
      type: 'image', mediaName: 'onboarding-direction.jpg', mediaUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=85',
    }),
    makeMessage('o-13', 'olivia', 'me', 'Alex Morgan', 'AM', 'The colors are lovely. The warm accent gives it just enough personality.', today(10, 10)),
    makeMessage('o-14', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'I went a little softer on the shadows too. Feels calmer, right?', today(10, 24)),
    makeMessage('o-15', 'olivia', 'me', 'Alex Morgan', 'AM', 'Totally. I’ll update the prototype before standup.', today(10, 31)),
    makeMessage('o-16', 'olivia', 'olivia-user', 'Olivia Chen', 'OC', 'That looks amazing! Let’s ship it 🚀', today(10, 42)),
  ],
  'product-design': [
    makeMessage('p-1', 'product-design', 'sam', 'Sam Rivera', 'SR', 'Good morning team! The first pass at the new workspace is ready for feedback.', today(9, 35)),
    makeMessage('p-2', 'product-design', 'olivia-user', 'Olivia Chen', 'OC', 'The calmer palette is working really nicely.', today(9, 47)),
    makeMessage('p-3', 'product-design', 'me', 'Alex Morgan', 'AM', 'Agreed. I’ll check responsive states this morning.', today(10, 2)),
    makeMessage('p-4', 'product-design', 'sam', 'Sam Rivera', 'SR', 'Dropped the new explorations in Figma', today(10, 18)),
  ],
  marcus: [
    makeMessage('m-1', 'marcus', 'me', 'Alex Morgan', 'AM', 'How was the trail on Sunday?', yesterday(17, 20)),
    makeMessage('m-2', 'marcus', 'marcus-user', 'Marcus Reed', 'MR', 'So good. The weather finally cooperated!', yesterday(17, 28)),
    makeMessage('m-3', 'marcus', 'marcus-user', 'Marcus Reed', 'MR', 'Voice message · 0:18', today(9, 56), 'delivered', { type: 'voice_note', metadata: { duration: 18 } }),
  ],
  'nexa-ai': [
    makeMessage('a-1', 'nexa-ai', 'me', 'Alex Morgan', 'AM', 'Help me plan a focused week around the product launch.', today(9, 14)),
    makeMessage('a-2', 'nexa-ai', 'nexa-ai-user', 'Nexa AI', '✦', 'Absolutely. Let’s protect a little deep-work time first. I found three helpful ideas for you.', today(9, 21), 'read', { type: 'ai_response' }),
  ],
  'weekend-hikers': [
    makeMessage('w-1', 'weekend-hikers', 'leo', 'Leo Grant', 'LG', 'Saturday looks like clear skies for the ridge trail 🌤️', yesterday(17, 45)),
    makeMessage('w-2', 'weekend-hikers', 'maya', 'Maya Park', 'MP', 'Start time still 8:30?', yesterday(18, 3)),
    makeMessage('w-3', 'weekend-hikers', 'me', 'Alex Morgan', 'AM', 'You: I’m in! 🥾', yesterday(18, 34)),
  ],
  'launch-channel': [
    makeMessage('c-1', 'launch-channel', 'channel-owner', 'Nexa team', 'NT', 'We’ve been working on a more thoughtful way to bring your day together.', yesterday(14, 50)),
    makeMessage('c-2', 'launch-channel', 'channel-owner', 'Nexa team', 'NT', 'A little preview of what’s next ✨', yesterday(15, 2)),
  ],
  mom: [
    makeMessage('mom-1', 'mom', 'mom-user', 'Mom', 'M', 'I sent you the recipe you asked for. It’s easier than it looks!', yesterday(12, 6)),
    makeMessage('mom-2', 'mom', 'mom-user', 'Mom', 'M', 'Don’t forget to call Nana 💛', yesterday(12, 15)),
  ],
  dana: [
    makeMessage('d-1', 'dana', 'me', 'Alex Morgan', 'AM', 'I’ve shared the updated timeline with the team.', yesterday(9, 56)),
    makeMessage('d-2', 'dana', 'dana-user', 'Dana Brooks', 'DB', 'Perfect, thanks for the update!', yesterday(10, 5)),
  ],
};

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignee: string;
  conversationId?: string;
}

export const demoTasks: TaskItem[] = [
  { id: 'task-1', title: 'Review onboarding empty states', description: 'Share feedback with Olivia before the design sync.', status: 'in_progress', priority: 'high', dueDate: '2026-10-14', assignee: 'Alex Morgan', conversationId: 'olivia' },
  { id: 'task-2', title: 'Send launch timeline to the team', description: 'Include the updated milestones and owners.', status: 'pending', priority: 'medium', dueDate: '2026-10-15', assignee: 'Alex Morgan', conversationId: 'product-design' },
  { id: 'task-3', title: 'Check mobile prototype', description: 'Test the redesigned chat composer on small screens.', status: 'pending', priority: 'urgent', dueDate: '2026-10-13', assignee: 'Alex Morgan' },
  { id: 'task-4', title: 'Collect launch feedback', description: 'Summarize the notes from this week’s review.', status: 'done', priority: 'low', dueDate: '2026-10-12', assignee: 'Alex Morgan' },
];
