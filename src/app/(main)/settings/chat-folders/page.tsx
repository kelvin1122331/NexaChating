'use client';

import { useState, type FormEvent } from 'react';
import { Bot, BriefcaseBusiness, Check, FolderHeart, Hash, Plus, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsCard, SettingsLayout, SettingsSectionHeading, SettingsToggle } from '@/components/settings/settings-layout';
import { useSettingsStore } from '@/stores/settings-store';
import { useChatStore } from '@/stores/chat-store';

const defaults = [
  { id: 'all', label: 'All chats', count: 8, icon: MessageIcon },
  { id: 'unread', label: 'Unread', count: 3, icon: Check },
  { id: 'personal', label: 'Personal', count: 4, icon: UsersRound },
  { id: 'work', label: 'Work', count: 2, icon: BriefcaseBusiness },
  { id: 'community', label: 'Community', count: 2, icon: Hash },
  { id: 'ai_tools', label: 'AI tools', count: 1, icon: Bot },
];

function MessageIcon({ size = 16 }: { size?: number }): JSX.Element { return <FolderHeart size={size} />; }

/** Smart folder manager for the default inbox tabs and user-created filters. */
export default function ChatFoldersSettingsPage(): JSX.Element {
  const customFolders = useSettingsStore((state) => state.customFolders);
  const addCustomFolder = useSettingsStore((state) => state.addCustomFolder);
  const removeCustomFolder = useSettingsStore((state) => state.removeCustomFolder);
  const conversations = useChatStore((state) => state.conversations);
  const [name, setName] = useState('');
  const [includeTypes, setIncludeTypes] = useState<string[]>(['personal']);
  const [excludeMuted, setExcludeMuted] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [color, setColor] = useState('#6366F1');

  const toggleType = (type: string): void => setIncludeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  const createFolder = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const title = name.trim();
    if (!title) return;
    if (customFolders.some((folder) => folder.name.toLowerCase() === title.toLowerCase())) { toast.error('A folder with that name already exists.'); return; }
    addCustomFolder({ name: title, icon: 'folder', color, includeTypes, excludeMuted, keyword: keyword.trim() });
    setName(''); setKeyword('');
    toast.success(`${title} folder created`);
  };

  return (
    <SettingsLayout title="Chat folders" description="Make room for the conversations that matter.">
      <div className="space-y-6">
        <section><SettingsSectionHeading title="Your tabs" description="These smart folders are ready in your inbox." /><SettingsCard>{defaults.map(({ id, label, count, icon: Icon }) => <div key={id} className="flex min-h-[58px] items-center gap-3 border-b border-line px-4 last:border-b-0 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-indigo-950/40 dark:text-indigo-300"><Icon size={16} /></span><span className="flex-1 text-xs font-semibold">{label}</span><span className="text-[10px] text-muted">{count} chats</span><Check size={14} className="text-emerald-500" /></div>)}</SettingsCard></section>
        <section><SettingsSectionHeading title="Custom folders" description="Filter conversations by type, muted status, or a keyword." /><SettingsCard>
          {customFolders.length ? customFolders.map((folder) => <div key={folder.id} className="flex min-h-[58px] items-center gap-3 border-b border-line px-4 last:border-b-0 md:px-5"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color: folder.color, backgroundColor: `${folder.color}18` }}><FolderHeart size={16} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{folder.name}</span><span className="mt-1 block truncate text-[10px] text-muted">{folder.includeTypes.join(', ') || 'All types'}{folder.keyword ? ` · “${folder.keyword}”` : ''}</span></span><span className="text-[10px] text-muted">{conversations.filter((conversation) => (!folder.includeTypes.length || folder.includeTypes.includes(conversation.type)) && (!folder.excludeMuted || !conversation.isMuted) && (!folder.keyword || `${conversation.title} ${conversation.lastMessage}`.toLowerCase().includes(folder.keyword.toLowerCase()))).length}</span><button onClick={() => { removeCustomFolder(folder.id); toast.success('Folder removed'); }} aria-label={`Remove ${folder.name}`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button></div>) : <p className="px-4 py-6 text-center text-xs text-muted">No custom folders yet.</p>}
          <form onSubmit={createFolder} className="space-y-4 border-t border-line bg-slate-50/60 p-4 dark:bg-slate-900/40 md:p-5">
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Folder name</span><div className="flex gap-2"><Input placeholder="e.g. Family, Side projects" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} /><input type="color" aria-label="Folder color" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-12 cursor-pointer rounded-xl border border-line bg-panel p-1" /></div></label>
            <div><p className="mb-2 text-xs font-medium">Include conversations</p><div className="flex flex-wrap gap-2">{['personal', 'group', 'channel'].map((type) => <button key={type} type="button" onClick={() => toggleType(type)} className={`min-h-9 rounded-full border px-3 text-[10px] font-semibold capitalize transition ${includeTypes.includes(type) ? 'border-brand-200 bg-brand-50 text-brand-700 dark:bg-indigo-950/40 dark:text-indigo-200' : 'border-line bg-panel text-muted'}`}>{type}</button>)}</div></div>
            <label className="block"><span className="mb-1.5 block text-xs font-medium">Match keyword <span className="text-muted">(optional)</span></span><Input placeholder="Search chat names and previews" value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={60} /></label>
            <SettingsToggle label="Hide muted chats" description="Keep quiet conversations out of this folder." checked={excludeMuted} onCheckedChange={setExcludeMuted} />
            <Button type="submit" size="sm" disabled={!name.trim()}><Plus size={14} /> Create folder</Button>
          </form>
        </SettingsCard></section>
      </div>
    </SettingsLayout>
  );
}
