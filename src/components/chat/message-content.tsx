import type { ReactNode } from 'react';

const TOKEN_PATTERN = /(https?:\/\/[^\s<]+|`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

function renderToken(token: string, key: number): ReactNode {
  if (/^https?:\/\//i.test(token)) {
    const safeUrl = token.replace(/[),.!?]+$/, '');
    const trailing = token.slice(safeUrl.length);
    let parsed: URL | null = null;
    try { parsed = new URL(safeUrl); } catch { parsed = null; }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) return token;
    return <span key={key}><a className="underline decoration-current/40 underline-offset-2 hover:decoration-current" href={parsed.href} rel="noopener noreferrer nofollow" target="_blank">{safeUrl}</a>{trailing}</span>;
  }
  if (token.startsWith('**') && token.endsWith('**')) return <strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>;
  if (token.startsWith('*') && token.endsWith('*')) return <em key={key}>{token.slice(1, -1)}</em>;
  if (token.startsWith('_') && token.endsWith('_')) return <em key={key}>{token.slice(1, -1)}</em>;
  if (token.startsWith('~') && token.endsWith('~')) return <del key={key}>{token.slice(1, -1)}</del>;
  if (token.startsWith('`') && token.endsWith('`')) return <code key={key} className="rounded bg-black/5 px-1 py-0.5 font-mono text-[.9em] dark:bg-white/10">{token.slice(1, -1)}</code>;
  return token;
}

/** Renders the supported lightweight chat markup using React text nodes (never raw HTML). */
export function MessageContent({ text }: { text: string }): JSX.Element {
  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        <span key={`line-${lineIndex}`}>
          {line.split(TOKEN_PATTERN).map((token, tokenIndex) => renderToken(token, tokenIndex))}
          {lineIndex < text.split('\n').length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}
