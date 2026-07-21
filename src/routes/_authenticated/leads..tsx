
// ============= Múltiplos contatos =============

type ContactPointRow = {
  id: string;
  kind: "whatsapp" | "phone" | "email" | "site";
  value: string;
  verified: boolean;
  preferred: boolean;
  sandbox: boolean;
  status: string | null;
  source: string | null;
  created_at: string;
};

function ContactPointsCard({ leadId, lead }: { leadId: string; lead: any }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactPoints);
  const upsertFn = useServerFn(upsertContactPoint);
  const delFn = useServerFn(deleteContactPoint);

  const q = useQuery({
    queryKey: ["contact-points", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });

  const [kind, setKind] = useState<"whatsapp" | "phone" | "email">("whatsapp");
  const [value, setValue] = useState("");
  const [sandbox, setSandbox] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: { lead_id: leadId, kind, value: value.trim(), sandbox, preferred: false },
      }),
    onSuccess: () => {
      setValue("");
      setSandbox(false);
      qc.invalidateQueries({ queryKey: ["contact-points", leadId] });
    },
  });
  const setPrefMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: true,
          verified: row.verified,
          sandbox: row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const toggleSandboxMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: row.preferred,
          verified: row.verified,
          sandbox: !row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const toggleVerifiedMut = useMutation({
    mutationFn: (row: ContactPointRow) =>
      upsertFn({
        data: {
          id: row.id,
          lead_id: leadId,
          kind: row.kind,
          value: row.value,
          preferred: row.preferred,
          verified: !row.verified,
          sandbox: row.sandbox,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-points", leadId] }),
  });

  const rows = (q.data ?? []) as ContactPointRow[];
  const iconFor: Record<string, React.ComponentType<{ className?: string }>> = {
    whatsapp: MessageCircle,
    phone: Phone,
    email: Mail,
    site: Building2,
  };
  const legacyHint =
    rows.length === 0 && (lead.whatsapp || lead.phone || lead.email)
      ? "Os campos legados (WhatsApp/telefone/e-mail) do lead ainda são usados até você adicionar um contato aqui."
      : null;

  return (
    <Card title="Contatos do lead">
      {legacyHint && (
        <div className="mb-2 rounded-md bg-warm-bg px-2 py-1 text-[11px] text-warm">{legacyHint}</div>
      )}
      <ul className="mb-3 space-y-1.5">
        {rows.length === 0 ? (
          <li className="text-[12px] text-text-ter">Nenhum contato cadastrado.</li>
        ) : (
          rows.map((r) => {
            const Icon = iconFor[r.kind] ?? MessageCircle;
            return (
              <li
                key={r.id}
                className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-text-ter" />
                  <span className="flex-1 truncate text-text-body">{r.value}</span>
                  {r.preferred && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      preferencial
                    </span>
                  )}
                  {r.sandbox && (
                    <span className="rounded-full bg-ia-bg px-1.5 py-0.5 text-[10px] font-medium text-ia">
                      teste
                    </span>
                  )}
                  {r.verified && (
                    <span className="rounded-full bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success">
                      válido
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-text-ter">
                  <span>{r.kind}</span>
                  {r.source && <span>· origem: {r.source}</span>}
                  {!r.preferred && (
                    <button
                      onClick={() => setPrefMut.mutate(r)}
                      className="ml-auto text-primary hover:underline"
                    >
                      tornar preferencial
                    </button>
                  )}
                  <button
                    onClick={() => toggleVerifiedMut.mutate(r)}
                    className="text-text-sec hover:underline"
                  >
                    {r.verified ? "marcar inválido" : "marcar válido"}
                  </button>
                  <button
                    onClick={() => toggleSandboxMut.mutate(r)}
                    className="text-ia hover:underline"
                  >
                    {r.sandbox ? "tirar teste" : "marcar teste"}
                  </button>
                  <button
                    onClick={() => delMut.mutate(r.id)}
                    className="text-hot hover:underline"
                    title="Remover"
                  >
                    <Trash2 className="inline h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="space-y-1.5 border-t border-border-card pt-2">
        <div className="flex gap-1">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            className="h-7 rounded-md border border-border-card bg-bg-card px-1 text-[11px]"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Telefone</option>
            <option value="email">E-mail</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "email" ? "email@empresa.com" : "(11) 99999-9999"}
            className="h-7 flex-1 rounded-md border border-border-card bg-bg-card px-2 text-[11px] outline-none focus:border-primary"
          />
          <button
            disabled={!value.trim() || addMut.isPending}
            onClick={() => addMut.mutate()}
            className="inline-flex h-7 items-center rounded-md bg-primary px-2 text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-text-ter">
          <input
            type="checkbox"
            checked={sandbox}
            onChange={(e) => setSandbox(e.target.checked)}
          />
          contato de teste (sandbox)
        </label>
      </div>
    </Card>
  );
}

// ============= Consentimento (LGPD) =============

type ConsentRow = {
  id: string;
  event: string;
  channel: string | null;
  source: string | null;
  text: string | null;
  actor_id: string | null;
  created_at: string;
};

function ConsentEventsCard({ leadId, lead }: { leadId: string; lead: any }) {
  const listFn = useServerFn(listConsentEvents);
  const q = useQuery({
    queryKey: ["consent-events", leadId],
    queryFn: () => listFn({ data: { lead_id: leadId } }),
  });
  const rows = (q.data ?? []) as ConsentRow[];
  const currentStatus: "opt_out" | "opt_in" | "desconhecido" = lead.opt_out
    ? "opt_out"
    : rows.some((r) => r.event === "opt_in" || r.event === "resubscribe")
      ? "opt_in"
      : "desconhecido";
  const statusTone =
    currentStatus === "opt_out"
      ? "bg-hot-bg text-hot"
      : currentStatus === "opt_in"
        ? "bg-success-bg text-success"
        : "bg-bg-general text-text-sec";

  return (
    <Card title="Consentimento (LGPD)">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-text-ter">Status atual</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}
        >
          <ShieldOff className="h-2.5 w-2.5" />
          {currentStatus === "opt_out"
            ? "opt-out"
            : currentStatus === "opt_in"
              ? "opt-in"
              : "desconhecido"}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-text-ter">Sem eventos registrados.</div>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-border-card bg-bg-general p-2 text-[11px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize text-text-body">{r.event}</span>
                <span className="text-text-ter">{r.channel ?? "—"}</span>
              </div>
              {r.text && <div className="mt-0.5 text-text-sec">{r.text}</div>}
              <div className="mt-0.5 flex items-center justify-between text-text-ter">
                <span>{r.source ?? "sistema"}</span>
                <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
