import type { RFPPhase } from '../hooks/useRFP';
import { IconClock, IconEye, IconUsers } from './Icons';

type Props = {
  phase: RFPPhase;
  secondsLeft: number;
  totalVendors: number;
  revealedCount: number;
  onAdvanceEarly?: () => void;
  canAdvanceEarly?: boolean;
};

const PHASE_META: Record<RFPPhase, { label: string; color: string }> = {
  Committing: { label: 'Commit Phase', color: 'var(--blue)' },
  Revealing: { label: 'Reveal Phase', color: 'var(--amber)' },
  Closed: { label: 'Round Closed', color: 'var(--green)' },
  Unknown: { label: 'Initializing…', color: 'var(--text-dim)' },
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function StatusBanner({
  phase,
  secondsLeft,
  totalVendors,
  revealedCount,
  onAdvanceEarly,
  canAdvanceEarly,
}: Props) {
  const meta = PHASE_META[phase];
  const bg = phase === 'Unknown' ? 'var(--surface)' : `${meta.color}14`;

  return (
    <div
      id="status-banner"
      className="status-banner"
      style={{ background: bg, borderColor: `${meta.color}30` }}
    >
      <div className="status-banner-left">
        <span className="phase-pill" style={{ color: meta.color }}>
          <span className="phase-dot" style={{ background: meta.color }} />
          {meta.label}
        </span>

        {phase !== 'Closed' && phase !== 'Unknown' && (
          <span className="countdown-pill">
            <IconClock size={13} />
            {formatDuration(secondsLeft)}
          </span>
        )}
      </div>

      <div className="status-banner-stats">
        <span>
          <IconUsers size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          <strong>{totalVendors}</strong> vendors
        </span>
        {phase !== 'Committing' && (
          <span>
            <IconEye size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            <strong>{revealedCount}/{totalVendors}</strong> revealed
          </span>
        )}
        {canAdvanceEarly && onAdvanceEarly && phase === 'Committing' && totalVendors > 0 && (
          <button
            onClick={onAdvanceEarly}
            className="btn-secondary btn-sm"
            title="Advance to Reveal phase early without waiting for the timer"
          >
            Close commit phase early
          </button>
        )}
      </div>
    </div>
  );
}
