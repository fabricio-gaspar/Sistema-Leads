export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-card p-10">
      <h2 className="text-lg font-semibold text-text-title">{title}</h2>
      <p className="mt-2 max-w-2xl text-[13px] text-text-sec">{description}</p>
      <p className="mt-4 text-[12px] text-text-ter">
        Esta tela será construída na próxima etapa.
      </p>
    </div>
  );
}
