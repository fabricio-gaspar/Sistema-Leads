import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadWaAkgAccounts, type WaAkgChannelStatus } from '@/lib/crm/whatsappAccountsRepository';
import { loadWaAkgContactDirectory, syncWaAkgContactDirectory, type WaAkgDirectoryContact } from '@/lib/crm/waAkgContactDirectoryRepository';

type Props = { administrator: boolean };

const displayPhone = (value: string) => value.replace(/(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 ($2) $3-$4');

export default function WaAkgContactDirectory({ administrator }: Props) {
  const [accounts, setAccounts] = useState<WaAkgChannelStatus[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [contacts, setContacts] = useState<WaAkgDirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);

  const selected = useMemo(() => accounts.find((entry) => entry.account?.id === selectedId) ?? null, [accounts, selectedId]);
  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadWaAkgAccounts();
      const visible = result.accounts.filter((entry) => entry.account?.accountType === 'seller');
      setAccounts(visible);
      setSelectedId((current) => visible.some((entry) => entry.account?.id === current) ? current : visible[0]?.account?.id ?? '');
      setNotice(visible.length ? '' : 'Nenhuma conta individual está disponível para sincronização.');
    } catch {
      setNotice('Não foi possível confirmar as contas WhatsApp agora.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refreshAccounts(); }, [refreshAccounts]);
  useEffect(() => {
    if (!selectedId) { setContacts([]); return; }
    let current = true;
    loadWaAkgContactDirectory(selectedId).then((next) => { if (current) setContacts(next); }).catch(() => {
      if (current) setNotice('Não foi possível carregar os contatos desta conta.');
    });
    return () => { current = false; };
  }, [selectedId]);

  const sync = async () => {
    if (!selectedId) return;
    setSyncing(true); setNotice('');
    try {
      const result = await syncWaAkgContactDirectory(selectedId);
      const next = await loadWaAkgContactDirectory(selectedId);
      setContacts(next);
      const identification = result.matched ? ` ${result.matched} conversa${result.matched === 1 ? '' : 's'} existente${result.matched === 1 ? '' : 's'} identificada${result.matched === 1 ? '' : 's'}.` : '';
      setNotice(result.status === 'partial'
        ? `Sincronização parcial: ${result.imported} contatos atualizados. O gateway informou limite de leitura.${identification}`
        : `Agenda sincronizada: ${result.imported} contatos atualizados.${identification}`);
    } catch {
      setNotice('A agenda não pôde ser sincronizada. A conexão e as conversas existentes não foram alteradas.');
    } finally { setSyncing(false); }
  };

  if (loading) return <section className="wf-surface wf-central-directory p-4 text-sm text-foreground-500">Carregando diretório privado…</section>;
  const contactLabel = contacts.length === 1 ? '1 contato disponível' : `${contacts.length} contatos disponíveis`;

  return <section className="wf-surface wf-central-directory overflow-hidden" aria-label="Agenda do WhatsApp">
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><i className="ri-contacts-book-2-line" /></span><div><h2 className="text-sm font-bold text-foreground-950">Agenda do WhatsApp</h2><p className="mt-0.5 text-xs text-foreground-500">{selected ? `${contactLabel} neste dispositivo` : 'Selecione um dispositivo para consultar os contatos'}</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={!selectedId || syncing} onClick={() => void sync()}><i className={syncing ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{syncing ? 'Sincronizando…' : 'Atualizar agenda'}</button><button type="button" className="wf-btn-secondary text-xs" aria-expanded={expanded} aria-controls="wa-akg-contact-list" onClick={() => setExpanded((value) => !value)}><i className={expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />{expanded ? 'Ocultar contatos' : 'Mostrar contatos'}</button></div>
    </div>
    <div className="border-t border-background-200 px-4 py-3">
      {administrator && accounts.length > 1 && <label className="block max-w-sm text-xs font-semibold text-foreground-700">Usuário / dispositivo<select className="mt-1 w-full wf-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{accounts.map((entry) => <option key={entry.account?.id} value={entry.account?.id ?? ''}>{entry.account?.label ?? 'Conta sem rótulo'}</option>)}</select></label>}
      {selected && <p className={`${administrator && accounts.length > 1 ? 'mt-2' : ''} text-xs text-foreground-600`}>Exibindo somente os contatos de <strong>{selected.account?.label}</strong>.</p>}
      {notice && <p role="status" className="mt-2 rounded-lg bg-background-100 px-3 py-2 text-xs text-foreground-700">{notice}</p>}
      {expanded && <div id="wa-akg-contact-list" className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-background-200 bg-white"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-background-50 text-foreground-500"><tr><th className="px-3 py-2 font-semibold">Contato</th><th className="px-3 py-2 font-semibold">Telefone</th></tr></thead><tbody>{contacts.length ? contacts.map((contact) => <tr key={contact.phone} className="border-t border-background-100"><td className="px-3 py-2 text-foreground-900">{contact.name}</td><td className="px-3 py-2 text-foreground-600">{displayPhone(contact.phone)}</td></tr>) : <tr><td colSpan={2} className="px-3 py-6 text-center text-foreground-500">Nenhum contato sincronizado ainda.</td></tr>}</tbody></table></div>}
    </div>
  </section>;
}
