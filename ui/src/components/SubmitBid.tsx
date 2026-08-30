import { useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { ContractService } from '../contractService';
import type { RFPState } from '../hooks/useRFP';
import { openMidnightExplorer, getContractExplorerUrl } from '../utils/explorer';
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
  onNavigateToReveal?: () => void;
};

function trunc(str: string): string {
  if (!str) return '';
  return str.length <= 20 ? str : `${str.slice(0, 10)}…${str.slice(-6)}`;
}

export function SubmitBid({
  wallet,
  walletAddress,
  contractAddress,
  rfp,
  onNavigateToReveal,
}: Props) {
  const [bid, setBid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userCommitment = rfp.vendors.find(
    (v) => v.walletAddress?.toLowerCase() === walletAddress.toLowerCase(),
  );

  const isCommittingPhase = rfp.phase === 'Committing';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) {
      setError('Please connect your Midnight wallet first — a real wallet is required to submit a bid on-chain.');
      return;
    }
    if (!contractAddress) {
      setError('Enter or create an RFP contract address first.');
      return;
    }
    if (!bid || isNaN(Number(bid)) || Number(bid) <= 0) {
      setError('Enter a valid positive bid amount.');
      return;
    }

    const numericBid = BigInt(bid);
    if (rfp.minBid > 0n && numericBid < rfp.minBid) {
      setError(`Bid must be at least ${rfp.minBid} tDUST.`);
      return;
    }
    if (rfp.maxBid > 0n && numericBid > rfp.maxBid) {
      setError(`Bid cannot exceed the budget cap of ${rfp.maxBid} tDUST.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);

      const result = await ContractService.submitCommitment({
        contractAddress,
        walletAddress,
        bid: numericBid,
        salt,
        wallet,
        onStatus: setStatus,
      });

      setBid('');
      setStatus(`✓ Bid sealed on Midnight ledger — Vendor Slot #${result.slot}.`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit commitment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="submit-bid" className="card view-card">
      <div className="card-header">
        <div className="card-title">
          <span className="title-icon">
            <IconLock size={18} />
          </span>
          <div>
            <h2>Sealed Bid Submission Vault</h2>
            <p className="card-sub">
              Your bid is hashed locally with a 256-bit cryptographic salt. Only the Poseidon hash is written on-chain.
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
            <span className="badge badge-green">
              <IconCheck size={12} /> Sealed · Slot #{userCommitment.index}
            </span>
          ) : isCommittingPhase ? (
            <span className="badge badge-blue">Ready to Seal Bid</span>
          ) : (
            <span className="badge badge-neutral">Commit Phase Ended</span>
          )}
        </div>
      </div>

      {userCommitment ? (
        /* Sealed Vault Receipt Card */
        <div className="vault-receipt-card">
          <div className="vault-receipt-header">
            <div className="vault-receipt-badge">
              <IconLock size={16} />
              <span>Bid Sealed in Vault</span>
            </div>
            <span className="badge badge-green">Vendor Slot #{userCommitment.index}</span>
          </div>

          <div className="vault-receipt-body">
            <p className="vault-receipt-title">Your bid is securely committed to the Midnight ledger</p>
            <div className="vault-meta-grid">
              <div className="vault-meta-item">
                <span className="meta-label">On-Chain Commitment Hash</span>
                <span className="meta-val mono" title={userCommitment.commitmentHash ?? ''}>
                  {userCommitment.commitmentHash
                    ? `${userCommitment.commitmentHash.slice(0, 16)}…${userCommitment.commitmentHash.slice(-10)}`
                    : '—'}
                </span>
              </div>
              <div className="vault-meta-item">
                <span className="meta-label">Local Salt &amp; Witness</span>
                <span className="meta-val mono text-green">✓ Saved in Private Storage</span>
              </div>
            </div>

            <div className="vault-next-step">
              <div className="next-step-icon">
                <IconClock size={15} />
              </div>
              <div className="next-step-text">
                <strong>Next Step: Zero-Knowledge Reveal Phase</strong>
                <span>
                  When the commit countdown finishes, submit your ZK range proof from the Reveal tab to be eligible for the award.
                </span>
              </div>
            </div>
          </div>

          <div className="vault-receipt-actions">
            {onNavigateToReveal && (
              <button className="btn-primary btn-sm" onClick={onNavigateToReveal}>
                <IconUnlock size={14} /> Go to Reveal Tab
              </button>
            )}
            <button
              className="btn-explorer btn-sm"
              onClick={() => openMidnightExplorer(contractAddress)}
            >
              <IconExternal size={13} /> View Contract on Explorer ↗
            </button>
          </div>
        </div>
      ) : isCommittingPhase ? (
        <form onSubmit={handleSubmit} className="form-stack" style={{ marginBottom: 24 }}>
          {/* Visual Cryptographic Pipeline */}
          <div className="zk-pipeline-card">
            <div className="pipeline-title">
              <IconSparkles size={14} />
              <span>Client-Side Cryptographic Boundary</span>
            </div>
            <div className="pipeline-steps">
              <div className="pipeline-node">
                <span className="node-label">Private Bid</span>
                <span className="node-val mono">{bid ? `${bid} tDUST` : 'Enter Amount'}</span>
              </div>
              <span className="pipeline-op">+</span>
              <div className="pipeline-node">
                <span className="node-label">Random 256-bit Salt</span>
                <span className="node-val mono">Local CSPRNG</span>
              </div>
              <span className="pipeline-op">➔</span>
              <div className="pipeline-node highlight">
                <span className="node-label">On-Chain Commitment</span>
                <span className="node-val mono">Poseidon Hash</span>
              </div>
            </div>
          </div>

          <label className="field">
            <span>Bid Amount (tDUST)</span>
            <input
              id="bid-amount"
              className="input mono bid-input-lg"
              type="number"
              min={Number(rfp.minBid) || 1}
              max={Number(rfp.maxBid) || undefined}
              placeholder={`Between ${rfp.minBid || 0} and ${rfp.maxBid || 'unlimited'} tDUST`}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              autoComplete="off"
              required
            />
            <span className="field-hint">
              Allowed Range: {rfp.minBid.toString()} – {rfp.maxBid > 0n ? rfp.maxBid.toString() : 'unlimited'} tDUST
            </span>
          </label>

          <div className="privacy-callout">
            <IconShield size={15} />
            <span>
              Your plaintext bid and salt remain strictly in this browser. No competitor or buyer can see what you bid.
            </span>
          </div>

          {error && <p className="form-status err">{error}</p>}
          {status && <p className="form-status ok">{status}</p>}

          <button
            id="submit-commitment"
            className="btn-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Sealing &amp; Publishing Commitment…
              </>
            ) : (
              <>
                <IconLock size={15} />
                Seal &amp; Submit Private Bid
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="panel panel-amber" style={{ marginBottom: 22 }}>
          The commit phase has ended for this round. No new bids can be submitted.
        </div>
      )}

      {/* Participating Vendors Board */}
      <div className="section-title">
        <span>Participating Vendors Board</span>
        <span className="section-count">{rfp.vendors.length} sealed on ledger</span>
      </div>

      {rfp.vendors.length === 0 ? (
        <div className="empty-vendor-box">
          <IconLock size={18} />
          <p>No sealed bids yet. Be the first vendor to submit a commitment!</p>
        </div>
      ) : (
        <div className="vendor-list">
          {rfp.vendors.map((v) => (
            <div key={v.index} className="vendor-row">
              <div className="vendor-row-main">
                <span className="slot-chip">#{v.index}</span>
                <div className="vendor-meta-stack">
                  <span className="vendor-addr mono" title={v.walletAddress}>
                    {v.walletAddress}
                  </span>
                  <span className="vendor-hash mono">
                    Poseidon: {v.commitmentHash ? `${v.commitmentHash.slice(0, 16)}…` : '—'}
                  </span>
                </div>
              </div>
              <div className="vendor-row-status">
                {v.revealed ? (
                  <span className="badge badge-green">
                    <IconCheck size={11} /> Revealed
                  </span>
                ) : (
                  <span className="badge badge-blue">
                    <IconLock size={11} /> Sealed
                  </span>
                )}
                <button
                  className="btn-icon subtle"
                  onClick={() => openMidnightExplorer(contractAddress)}
                  title="View on Midnight Explorer"
                  aria-label="View on Explorer"
                >
                  <IconExternal size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
