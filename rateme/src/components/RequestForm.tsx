import { BotFields, Notice } from './ui';
import { SubmitButton } from './SubmitButton';
import { submitRequest } from '@/lib/request-action';

export function RequestForm({ back, kinds, sent, error }: { back: string; kinds: [string, string][]; sent?: string; error?: string }) {
  if (sent) return <Notice kind="ok">Thanks — we’ve received your request and will reply by email. GDPR requests are answered within one month.</Notice>;
  return (
    <form action={submitRequest} className="card mt-6 space-y-4 p-5 not-prose">
      {error && <Notice kind="error">{error}</Notice>}
      <input type="hidden" name="back" value={back} />
      <BotFields />
      <label className="field"><span className="label">Type of request</span>
        <select name="kind" className="select" required defaultValue="">{[['', 'Choose one'], ...kinds].map(([v, l]) => <option key={v} value={v} disabled={!v}>{l}</option>)}</select></label>
      <label className="field"><span className="label">Your email</span><input name="email" type="email" className="input" required /></label>
      <label className="field"><span className="label">Details</span><textarea name="details" className="textarea" required minLength={10} maxLength={4000} placeholder="Include links to the listing or review concerned." /></label>
      <SubmitButton pendingText="Sending…">Send</SubmitButton>
    </form>
  );
}
