import { useId } from 'react';

interface InfoTooltipProps {
  text: string;
  label?: string;
  align?: 'start' | 'center' | 'end';
}

export default function InfoTooltip({ text, label = 'Mais informações', align = 'center' }: InfoTooltipProps) {
  const tooltipId = useId();

  return <span className={`wf-info-tooltip wf-info-tooltip--${align}`}>
    <button type="button" className="wf-info-tooltip__trigger" aria-label={label} aria-describedby={tooltipId}>
      <i className="ri-information-line" aria-hidden="true" />
    </button>
    <span id={tooltipId} role="tooltip" className="wf-info-tooltip__bubble">{text}</span>
  </span>;
}
