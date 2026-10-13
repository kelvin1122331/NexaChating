-- Small, bundled starter sticker pack. Rows are deterministic and safe to reapply.
insert into public.sticker_packs (id, name, creator_id, cover_url, is_official, is_animated)
values ('00000000-0000-4000-8000-000000000001', 'Nexa Essentials', null, '/stickers/sparkles.svg', true, false)
on conflict (id) do update set
  name = excluded.name,
  cover_url = excluded.cover_url,
  is_official = true,
  is_animated = false;

insert into public.stickers (id, pack_id, emoji, file_url, file_type)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '👋', '/stickers/wave.svg', 'svg'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '❤️', '/stickers/heart.svg', 'svg'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', '😂', '/stickers/laugh.svg', 'svg'),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', '✨', '/stickers/sparkles.svg', 'svg')
on conflict (id) do update set
  pack_id = excluded.pack_id,
  emoji = excluded.emoji,
  file_url = excluded.file_url,
  file_type = excluded.file_type;
