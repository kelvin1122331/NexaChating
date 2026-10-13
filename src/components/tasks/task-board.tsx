'use client';

import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { addDays, isBefore, parseISO, startOfDay } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays, Check, CheckSquare, ChevronDown, Circle, Clock3, ListFilter,
  Plus, Sparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { formatTaskDueDate } from '@/lib/utils/format-date';
import { useChatStore } from '@/stores/chat-store';
import type { TaskItem } from '@/lib/demo-data';

const columns: Array<{ id: TaskItem['status']; title: string; accent: string }> = [
  { id: 'pending', title: 'To do', accent: 'bg-slate-300' },
  { id: 'in_progress', title: 'In progress', accent: 'bg-brand-500' },
  { id: 'done', title: 'Done', accent: 'bg-emerald-500' },
];

const priorityTone: Record<TaskItem['priority'], 'neutral' | 'brand' | 'warning' | 'danger'> = {
  low: 'neutral', medium: 'brand', high: 'warning', urgent: 'danger',
};

function TaskCard({ task, onUpdate }: { task: TaskItem; onUpdate: (id: string, updates: Partial<TaskItem>) => void }): JSX.Element {
  const overdue = Boolean(task.dueDate && task.status !== 'done' && isBefore(parseISO(`${task.dueDate}T12:00:00`), startOfDay(new Date())));
  return (
    <motion.article layout draggable onDragStartCapture={(event) => event.dataTransfer.setData('text/plain', task.id)} className="group rounded-2xl border border-line bg-panel p-4 shadow-card transition hover:border-brand-200 hover:shadow-soft">
      <div className="flex items-start gap-2.5">
        <button onClick={() => onUpdate(task.id, { status: task.status === 'done' ? 'pending' : 'done' })} className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition', task.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-brand-400 dark:border-slate-600')} aria-label={task.status === 'done' ? 'Reopen task' : 'Mark task done'}><Check size={12} /></button>
        <div className="min-w-0 flex-1"><h3 className={cn('text-[13px] font-semibold leading-5', task.status === 'done' && 'text-slate-400 line-through')}>{task.title}</h3>{task.description ? <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-muted">{task.description}</p> : null}</div>
        <div className="relative"><select aria-label={`Change status for ${task.title}`} value={task.status} onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskItem['status'] })} className="absolute inset-0 z-10 h-8 w-8 cursor-pointer opacity-0"><option value="pending">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select><span className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition group-hover:bg-slate-100 group-hover:text-slate-500 dark:group-hover:bg-slate-800"><ChevronDown size={15} /></span></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Badge tone={priorityTone[task.priority]} className="capitalize">{task.priority}</Badge>
        <div className="flex items-center gap-2.5 text-[10px] text-muted">
          {task.dueDate ? <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-rose-600 dark:text-rose-300')}><CalendarDays size={12} />{overdue ? 'Overdue' : formatTaskDueDate(task.dueDate)}</span> : null}
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-indigo-200 to-violet-200 text-[8px] font-bold text-indigo-900" title={task.assignee}>{task.assignee.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
        </div>
      </div>
    </motion.article>
  );
}

function NewTaskDialog({ onCreate }: { onCreate: (task: Omit<TaskItem, 'id'>) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskItem['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskItem['status']>('pending');

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim(), status, priority, dueDate: dueDate || undefined, assignee: 'Alex Morgan' });
    setTitle(''); setDescription(''); setPriority('medium'); setDueDate(''); setStatus('pending'); setOpen(false);
    toast.success('Task added to your board');
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><Button><Plus size={16} /> New task</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] max-h-[90dvh] w-[min(460px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-line bg-panel p-6 shadow-soft focus:outline-none">
          <div className="flex items-start justify-between"><div><Dialog.Title className="text-lg font-semibold">Create a task</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted">Make the next step easy to find.</Dialog.Description></div><Dialog.Close className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={17} /></Dialog.Close></div>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Task title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" autoFocus required maxLength={300} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Description <span className="text-muted">(optional)</span></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a little context" maxLength={2_000} rows={3} className="w-full resize-none rounded-xl border border-line bg-panel px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as TaskItem['priority'])} className="h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm outline-none focus:border-brand-300"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium">Due date</span><Input type="date" min={new Date().toISOString().slice(0, 10)} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            </div>
            <Button type="submit" className="w-full" disabled={!title.trim()}><Plus size={15} /> Add to board</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Three-column task board with draggable cards and a create-task flow. */
export function TaskBoard(): JSX.Element {
  const tasks = useChatStore((state) => state.tasks);
  const addTask = useChatStore((state) => state.addTask);
  const updateTask = useChatStore((state) => state.updateTask);
  const currentUserName = useChatStore((state) => state.user.displayName);
  const backendMode = useChatStore((state) => state.backendMode);
  const [filter, setFilter] = useState<'all' | 'mine' | 'high'>('all');

  const createTask = (input: Omit<TaskItem, 'id'>): void => {
    const localTask = addTask({ ...input, assignee: currentUserName });
    if (!backendMode) return;
    void (async () => {
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: localTask.title,
            description: localTask.description,
            priority: localTask.priority,
            dueDate: localTask.dueDate,
          }),
        });
        if (!response.ok) {
          toast.error('The task was added locally but could not be saved to your account.');
          return;
        }
        const result = await response.json() as { task?: { id: string; due_date: string | null } };
        if (result.task?.id) updateTask(localTask.id, { id: result.task.id, dueDate: result.task.due_date ?? undefined });
      } catch {
        toast.error('The task was added locally but could not be saved to your account.');
      }
    })();
  };

  const changeTask = (id: string, updates: Partial<TaskItem>): void => {
    const task = tasks.find((item) => item.id === id);
    updateTask(id, updates);
    if (!backendMode || !task || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return;
    const body: Record<string, string> = {};
    if (updates.status) body.status = updates.status;
    if (updates.title) body.title = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.priority) body.priority = updates.priority;
    if (updates.dueDate !== undefined) body.dueDate = updates.dueDate;
    void fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((response) => {
      if (!response.ok) toast.error('The task change could not be saved.');
    }).catch(() => toast.error('The task change could not be saved.'));
  };

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'mine') return task.assignee === currentUserName;
    if (filter === 'high') return task.priority === 'high' || task.priority === 'urgent';
    return true;
  }), [currentUserName, filter, tasks]);

  const dropOnColumn = (event: DragEvent<HTMLDivElement>, status: TaskItem['status']): void => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) changeTask(taskId, { status });
  };

  const completed = tasks.filter((task) => task.status === 'done').length;
  const dueSoon = tasks.filter((task) => task.dueDate && task.status !== 'done' && task.dueDate <= addDays(new Date(), 2).toISOString().slice(0, 10)).length;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 md:px-8">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckSquare size={19} /></span><div><h1 className="text-base font-semibold">Tasks</h1><p className="mt-0.5 text-[11px] text-muted">Small steps, good momentum.</p></div></div>
        <NewTaskDialog onCreate={createTask} />
      </header>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-panel p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">On your board</p><p className="mt-2 text-2xl font-semibold">{tasks.length}</p><p className="mt-1 text-[10px] text-muted">tasks to keep in view</p></div>
            <div className="rounded-2xl border border-line bg-panel p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Completed</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{completed}</p><p className="mt-1 text-[10px] text-muted">nice work so far</p></div>
            <div className="col-span-2 rounded-2xl border border-line bg-gradient-to-br from-brand-50 to-indigo-50 p-4 sm:col-span-1 dark:from-indigo-950/50 dark:to-slate-900"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600 dark:text-indigo-300"><Clock3 size={12} /> Coming up</p><p className="mt-2 text-2xl font-semibold">{dueSoon}</p><p className="mt-1 text-[10px] text-muted">due in the next 2 days</p></div>
          </div>
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><ListFilter size={15} className="text-slate-400"/><select aria-label="Filter tasks" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-9 rounded-xl border border-line bg-panel px-3 text-xs font-medium outline-none"><option value="all">All tasks</option><option value="mine">Assigned to me</option><option value="high">High priority</option></select></div><span className="hidden items-center gap-1.5 text-[10px] text-muted sm:flex"><Sparkles size={12} className="text-brand-500" /> Drag tasks between columns</span></div>
          <div className="scrollbar-none -mx-4 flex min-h-[420px] snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
            {columns.map((column) => {
              const columnTasks = filteredTasks.filter((task) => task.status === column.id);
              return (
                <div key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnColumn(event, column.id)} className="flex w-[min(84vw,350px)] shrink-0 snap-start flex-col rounded-3xl border border-line bg-slate-50/75 p-3 dark:bg-slate-900/40 md:w-auto">
                  <div className="flex items-center justify-between px-1 pb-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} /><h2 className="text-xs font-semibold">{column.title}</h2><span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[10px] font-semibold text-muted dark:bg-slate-800">{columnTasks.length}</span></div><button onClick={() => { if (column.id === 'pending') createTask({ title: 'New task', description: '', status: 'pending', priority: 'medium', assignee: currentUserName }); else toast(`Drag a task to ${column.title.toLowerCase()}.`); }} className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-white hover:text-brand-600 dark:hover:bg-slate-800" aria-label={`Add task to ${column.title}`}><Plus size={16} /></button></div>
                  <div className="flex flex-1 flex-col gap-2.5">
                    <AnimatePresence initial={false}>{columnTasks.map((task) => <TaskCard key={task.id} task={task} onUpdate={changeTask} />)}</AnimatePresence>
                    {columnTasks.length === 0 ? <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/50 p-4 text-center dark:bg-slate-900/30"><Circle size={17} className="text-slate-300" /><p className="mt-2 text-[11px] font-medium text-slate-400">Nothing here yet</p><p className="mt-1 text-[10px] text-slate-400">Drop a task in this column</p></div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
