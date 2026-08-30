import { useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { ContractService } from '../contractService';
import type { RFPState } from '../hooks/useRFP';
import { openMidnightExplorer } from '../utils/explorer';
import {
  IconCheck,
  IconClock,
  IconExternal,
  IconLock,
  IconShield,
  IconSparkles,
  IconUnlock,
} from './Icons';

type Props = {
  wallet: ConnectedAPI | null;
  walletAddress: string;
  contractAddress: string;
  rfp: RFPState;
  onAdvanceEarly?: () => void;
  onNavigateToResults?: () => void;
};

function trunc(str: string): string {
  if (!str) return '';
  return str.length <= 20 ? str : `${str.slice(0, 10)}…${str.slice(-6)}`;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function RevealBid({
  wallet,
  walletAddress,
  contractAddress,
  rfp,
  onAdvanceEarly,
  onNavigateToResults,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userCommitment = rfp.vendors.find(
    (v) => v.walletAddress?.toLowerCase() === walletAddress.toLowerCase(),
  );

  const isRevealPhase = rfp.phase === 'Revealing' || rfp.phase === 'Closed';
  const isAlreadyRevealed = userCommitment?.revealed ?? false;
  const revealProgress =
    rfp.totalVendors > 0
      ? Math.round((rfp.revealedCount / rfp.totalVendors) * 100)
      : 0;

  const handleReveal = async () => {
    if (!wallet) {
      setError('Please connect your Midnight wallet first — a real wallet is required to submit a ZK reveal on-chain.');
      return;
    }
    if (!contractAddress) {
      setError('Enter or create an RFP contract address first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await ContractService.revealBid({
        contractAddress,
        walletAddress,
        wallet,
        onStatus: setStatus,
      });

      setStatus('✓ Bid revealed on Midnight ledger — ZK range & authenticity proof confirmed.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reveal bid');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="reveal-bid" className="card view-card">
      <div className="card-header">
        <div className="card-title">
          <span className="title-icon">
            <IconUnlock size={18} />
          </span>
          <div>
            <h2>Zero-Knowledge Reveal Prover</h2>
            <p className="card-sub">
              Prove in zero knowledge that your sealed commitment matches a valid bid within range. Price amounts remain private.
            </p>
          </div>
        </div>
      </div>

      {/* Identity & Status Strip */}
      <div className="identity-strip">
        <div className="identity-info">
          <span className="identity-label">Connected Bidder</span>
          <span className="identity-addr mono">
            {walletAddress ? trunc(walletAddress) : 'No wallet connected'}
          </span>
        </div>
        <div>
          {userCommitment ? (
            isAlreadyRevealed ? (
              <span className="badge badge-green">
                <IconCheck size={12} /> Revealed On-Chain
              </span>
            ) : (
              <span className="badge badge-amber">
                Slot #{userCommitment.index} · Awaiting Reveal
              </span>
            )
          ) : (
            <span className="badge badge-neutral">No Bid From This Wallet</span>
          )}
        </div>
      </div>

      {/* Reveal Progress Tracker */}
      <div className="reveal-progress-card">
        <div className="progress-header">
          <div className="progress-title">
            <IconSparkles size={14} />
            <span>Tender Reveal Progress</span>
          </div>
          <span className="progress-stat mono">
            <strong>{rfp.revealedCount}</strong> of <strong>{rfp.totalVendors}</strong> vendors revealed ({revealProgress}%)
          </span>
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${revealProgress}%` }}
          />
        </div>
      </div>

      {!userCommitment ? (
        <div className="panel panel-neutral" style={{ marginBottom: 20 }}>
          This wallet has not submitted a sealed commitment for this round. Switch to the wallet you used to bid, or submit a bid from the <strong>Seal Bid</strong> tab while the commit phase is active.
        </div>
      ) : isAlreadyRevealed ? (
        <div className="vault-receipt-card" style={{ marginBottom: 20 }}>
          <div className="vault-receipt-header">
            <div className="vault-receipt-badge" style={{ color: 'var(--green)' }}>
              <IconCheck size={16} />
              <span>Zero-Knowledge Proof Verified</span>
            </div>
            <span className="badge badge-green">Slot #{userCommitment.index} Verified</span>
          </div>
          <p className="vault-receipt-title" style={{ margin: '10px 0 6px' }}>
            Your bid authenticity and tender range check were proven in ZK without revealing the price.
          </p>
          <div className="vault-receipt-actions" style={{ marginTop: 14 }}>
            {onNavigateToResults && (
              <button className="btn-primary btn-sm" onClick={onNavigateToResults}>
                <IconShield size={14} /> View Round Results &amp; Audit
              </button>
            )}
            <button
              className="btn-explorer btn-sm"
              onClick={() => openMidnightExplorer(contractAddress)}
            >
              <IconExternal size={13} /> View on Midnight Explorer ↗
            </button>
          </div>
        </div>
      ) : !isRevealPhase ? (
        <div className="panel panel-blue" style={{ marginBottom: 20 }}>
          <div>
            <IconClock size={15} style={{ verticalAlign: '-2px', marginRight: 8 }} />
            <strong>Commit phase is active</strong> — {formatTime(rfp.secondsLeft)} remaining.
            <div className="muted-note" style={{ marginTop: 4 }}>
              Zero-knowledge reveals will unlock on-chain as soon as this commit countdown reaches 00:00.
            </div>
          </div>
        </div>
      ) : (
        /* Ready to reveal form */
        <div className="form-stack" style={{ marginBottom: 24 }}>
          <div className="zk-pipeline-card">
            <div className="pipeline-title">
              <IconShield size={14} />
              <span>3-Step Zero-Knowledge Prover Circuit</span>
            </div>
            <div className="prover-steps-list">
              <div className="prover-step-item">
                <span className="step-num">1</span>
                <div>
                  <strong>Local Witness Retrieval</strong>
                  <p>Fetch private bid &amp; 256-bit salt from local storage</p>
                </div>
              </div>
              <div className="prover-step-item">
                <span className="step-num">2</span>
                <div>
                  <strong>Range &amp; Authenticity Proof</strong>
                  <p>Prove in ZK: <code>hash(bid, salt) == commitment</code> &amp; <code>{rfp.minBid.toString()} &le; bid &le; {rfp.maxBid.toString()}</code></p>
                </div>
              </div>
              <div className="prover-step-item">
                <span className="step-num">3</span>
                <div>
                  <strong>On-Chain State Transition</strong>
                  <p>Submit proof to Midnight smart contract; set revealed flag</p>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="form-status err">{error}</p>}
          {status && <p className="form-status ok">{status}</p>}

          <button
            id="submit-reveal"
            className="btn-primary"
            onClick={handleReveal}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Executing ZK Prover Circuit…
              </>
            ) : (
              <>
                <IconUnlock size={15} />
                Generate ZK Proof &amp; Reveal Bid
              </>
            )}
          </button>
        </div>
      )}

      {/* Vendor Status List */}
      <div className="section-title">
        <span>Vendor Reveal Status</span>
        <span className="section-count">{rfp.revealedCount} of {rfp.totalVendors} completed</span>
      </div>

      {rfp.vendors.length === 0 ? (
        <div className="empty-vendor-box">
          <p>No vendors registered for this round.</p>
        </div>
      ) : (
        <div className="vendor-list">
          {rfp.vendors.map((v) => (
            <div key={v.index} className="vendor-row">
              <div className="vendor-row-main">
                <span className="slot-chip">#{v.index}</span>
                <span className="vendor-addr mono" title={v.walletAddress}>
                  {v.walletAddress}
                </span>
              </div>
              <div>
                {v.revealed ? (
                  <span className="badge badge-green">
                    <IconCheck size={11} /> Revealed &amp; Verified
                  </span>
                ) : (
                  <span className="badge badge-amber">
                    <IconClock size={11} /> Awaiting Reveal
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
