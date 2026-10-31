'use client';
import { useState } from 'react';
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button type="button" className="btn btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setState('done'); } catch { setState('failed'); } setTimeout(() => setState('idle'), 2500); }}>
      <span aria-live="polite">{state === 'done' ? 'Copied' : state === 'failed' ? 'Copy blocked: select the text and copy it' : label}</span>
    </button>
  );
}
