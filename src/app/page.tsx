import { redirect } from 'next/navigation';

/** Sends visitors to the inbox, the primary NexaChat workspace. */
export default function HomePage(): never {
  redirect('/chat');
}
