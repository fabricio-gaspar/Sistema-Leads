import { useEffect, useState } from 'react';
import { acceptTeamInvite, loadPendingTeamInvites, roleLabel, type PendingTeamInvite } from '@/lib/crm/teamMembersRepository';

/** Authenticated, but deliberately independent of an active tenant/CRM store. */
export default function PendingInvitesGate({ onAccepted, onSignOut, onContinue }: {
  onAccepted: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onContinue?: () => void;
}) {
  const [invites, setInvites] = useState<PendingTeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void loadPendingTeamInvites().then((items) => { if (current) setInvites(items); })
      .catch(() => { if (current) setError('Não foi possível consultar convites. Tente entrar novamente.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  const accept = async (invite: PendingTeamInvite) => {
    setBusy(invite.id); setError('');
    try { await acceptTeamInvite(invite); await onAccepted(); }
    catch { setError('O convite não foi aceito. Pode ter expirado, sido cancelado ou substituído; atualize a página.'); }
    finally { setBusy(null); }
  };
  return <main className="min-h-screen bg-background-50 p-6"><section className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
    <h1 className="text-xl font-bold">Convites pendentes</h1>
    <p className="text-sm">Confirme a empresa e o papel antes de aceitar. Sua conta e senha não serão alteradas pelo administrador da empresa.</p>
    {error && <p role="alert" className="text-accent-700">{error}</p>}
    {loading ? <p role="status">Consultando convites…</p> : invites.length === 0 ? <p>Não há convite válido para seu e-mail confirmado. Solicite um novo convite ao administrador, ou confirme seu e-mail.</p> : invites.map((invite) => <article key={invite.id} className="space-y-2 rounded-xl border p-4">
      <h2 className="font-semibold">{invite.organization_name}</h2>
      <p className="text-sm">Papel: {roleLabel[invite.role]} · {invite.email}</p>
      <p className="text-xs">Válido até {new Date(invite.expires_at).toLocaleString('pt-BR')}</p>
      <button type="button" className="wf-btn-primary" disabled={busy !== null} onClick={() => void accept(invite)}>{busy === invite.id ? 'Aceitando…' : 'Aceitar vínculo com esta empresa'}</button>
    </article>)}
    <div className="flex gap-3">{onContinue && <button type="button" className="wf-btn-secondary" onClick={onContinue}>Continuar na empresa atual</button>}<button type="button" className="wf-btn-secondary" onClick={() => void onSignOut()}>Sair</button></div>
  </section></main>;
}
