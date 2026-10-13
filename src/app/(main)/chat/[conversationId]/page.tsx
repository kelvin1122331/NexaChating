import { ChatRoom } from '@/components/chat/chat-room';

/** Renders the selected conversation in the shared chat workspace. */
export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }): Promise<JSX.Element> {
  const { conversationId } = await params;
  return <ChatRoom conversationId={conversationId} />;
}
