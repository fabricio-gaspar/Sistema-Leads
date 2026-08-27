export interface FilterChip {
  label: string;
  value: string;
  onRemove: () => void;
}

export default function FilterChips({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={`${c.label}-${c.value}`}
          className="inline-flex items-center gap-1.5 bg-secondary-100 text-secondary-900 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium"
        >
          <span className="text-secondary-600">{c.label}:</span>
          <span className="font-semibold">{c.value}</span>
          <button
            onClick={c.onRemove}
            aria-label={`Remover filtro ${c.label}`}
            className="w-5 h-5 flex items-center justify-center rounded-full text-secondary-700 hover:bg-secondary-200 cursor-pointer"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        </span>
      ))}
    </div>
  );
}