import type { Metadata } from 'next';
import { TaskBoard } from '@/components/tasks/task-board';

export const metadata: Metadata = { title: 'Tasks' };

/** Personal task board linked to conversations. */
export default function TasksPage(): JSX.Element {
  return <TaskBoard />;
}
