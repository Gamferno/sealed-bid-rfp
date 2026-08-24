import { useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { ContractService } from '../contractService';
import type { RFPState } from '../hooks/useRFP';
import { openMidnightExplorer } from '../utils/explorer';
import {
  IconCheck,
  IconCode,
  IconExternal,
  IconLock,
  IconShield,
  IconSparkles,
  IconTrophy,
} from './Icons';

type Props = {
  wallet: ConnectedAPI | null;
  walletAddress: string;
  contractAddress: string;
  rfp: RFPState;
  onOpenInspector?: () => void;
};

function trunc(str: string): string {
  if (!str) return '';
  return str.length <= 22 ? str : `${str.slice(0, 12)}…${str.slice(-8)}`;
}

export function Results({
  wallet,
  walletAddress,
  contractAddress,
  rfp,
  onOpenInspector,
}: Props) {
  const [verifying, setVerifying] = useState(false);
  const [determining, setDetermining] = useState(false);
  const [fairnessResult, setFairness] = useState<boolean | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canDetermineWinner =
    rfp.winnerIndex === null &&
    rfp.revealedCount > 0 &&
    (rfp.phase === 'Revealing' || rfp.phase === 'Closed' || rfp.revealedCount === rfp.totalVendors);

  const handleDetermineWinner = async () => {
    if (!contractAddress) return;
    setDetermining(true);
    setError(null);
    setStatusMsg('Running the determine_winner.zkir min-finding circuit across revealed bids…');
    try {
      const res = await ContractService.determineWinner({ contractAddress, wallet });
      setStatusMsg(`Winner determined: Vendor Slot #${res.winnerSlot} (${trunc(res.winnerWallet)}).`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to finalize winner');
    } finally {
      setDetermining(false);
    }
  };

  const handleVerify = async () => {
    if (!wallet && !walletAddress) {
      setError('Please connect your Midnight wallet first.');
      return;
    }
    if (!contractAddress) {
      setError('Contract address is required.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const isValid = await ContractService.verifyFairness({ contractAddress, wallet });
      setFairness(isValid);
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section id="results" className="card view-card">
      <div className="card-header">
        <div className="card-title">
          <span className="title-icon">
            <IconTrophy size={18} />
          </span>
          <div>
            <h2>Round Settlement &amp; Fairness Audit</h2>
            <p className="card-sub">
              The winner is determined in zero knowledge: only the winning slot index is disclosed. All bid amounts remain permanently private.
            </p>
          </div>
        </div>
      </div>

      {rfp.winnerIndex === null ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconTrophy size={26} />
          </div>
          <h2>
            {rfp.phase === 'Committing'
              ? 'Commit Phase in Progress'
              : 'Awaiting ZK Reveals'}
          </h2>
          <p>
            {rfp.phase === 'Committing'
              ? 'Vendors are sealing their commitments. Settlement opens once bids are revealed.'
              : `${rfp.revealedCount} of ${rfp.totalVendors} vendors have revealed their bids.`}
          </p>

          {canDetermineWinner && (
            <div className="empty-state-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button
                id="determine-winner-early"
                className="btn-primary"
                onClick={handleDetermineWinner}
                disabled={determining}
              >
                {determining ? (
                  <>
                    <span className="spinner" />
                    Computing Minimum Bidder in ZK…
                  </>
                ) : (
                  <>
                    <IconSparkles size={15} />
                    Finalize &amp; Determine Lowest Bidder (ZK Circuit)
                  </>
                )}
              </button>
            </div>
          )}

          {error && <p className="form-status err" style={{ marginTop: 14 }}>{error}</p>}
          {statusMsg && <p className="form-status ok" style={{ marginTop: 14 }}>{statusMsg}</p>}
        </div>
      ) : (
        <>
          {/* Winner Podium Hero Card */}
          <div className="winner-podium-card">
            <div className="podium-trophy-badge">
              <IconTrophy size={24} />
            </div>
            <div className="podium-label">Awarded Contractor</div>
            <div className="podium-slot">Vendor Slot #{rfp.winnerIndex}</div>
            {rfp.winnerWallet && (
              <div className="podium-addr mono" title={rfp.winnerWallet}>
                {rfp.winnerWallet}
              </div>
            )}
            <p className="podium-note">
              Selected fairly via the Midnight <code>determine_winner</code> ZK circuit. Winning and losing bid prices remain 100% private.
            </p>
            <div className="podium-actions">
              <button
                className="btn-explorer btn-sm"
                onClick={() => openMidnightExplorer(contractAddress)}
              >
                <IconExternal size={13} /> View Proof on Midnight Explorer ↗
              </button>
              {onOpenInspector && (
                <button className="btn-secondary btn-sm" onClick={onOpenInspector}>
                  <IconCode size={13} /> Inspect On-Chain State
                </button>
              )}
            </div>
          </div>

          {/* Proof Strip */}
          {rfp.proofValid && (
            <div className="proof-strip">
              <IconCheck size={15} />
              <span>
                Zero-Knowledge Proof Recorded: The smart contract confirms the winner mathematically holds the lowest valid bid.
              </span>
            </div>
          )}

          {/* Private Tender Matrix Table */}
          <div className="tender-matrix-section">
            <div className="section-title" style={{ marginTop: 16 }}>
              <span>Zero-Leakage Tender Matrix</span>
              <span className="badge badge-green">Zero Price Exposure</span>
            </div>

            <div className="matrix-table-wrap">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Slot</th>
                    <th>Vendor Public Key</th>
                    <th>ZK Range Check</th>
                    <th>Bid Price Privacy</th>
                    <th>Procurement Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {rfp.vendors.map((v) => {
                    const isWinner = v.index === rfp.winnerIndex;
                    return (
                      <tr key={v.index} className={isWinner ? 'winner-row' : ''}>
                        <td className="mono">
                          <strong>#{v.index}</strong>
                        </td>
                        <td className="mono" title={v.walletAddress ?? ''}>
                          {trunc(v.walletAddress ?? '')}
                        </td>
                        <td>
                          {v.revealed ? (
                            <span className="badge badge-green badge-xs">
                              <IconCheck size={10} /> Validated
                            </span>
                          ) : (
                            <span className="badge badge-amber badge-xs">
                              Unrevealed
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-private">
                            <IconLock size={10} /> Kept Private via ZK
                          </span>
                        </td>
                        <td>
                          {isWinner ? (
                            <span className="badge badge-gold">
                              <IconTrophy size={11} /> Awarded Winner
                            </span>
                          ) : (
                            <span className="badge badge-neutral badge-xs">
                              Non-Winning (Sealed)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Fairness Verification Box */}
          <div className="fairness-box">
            <div className="fairness-header">
              <div className="fairness-title">
                <IconShield size={16} />
                <span>On-Chain Fairness Verification (Audit View)</span>
              </div>
              <button
                id="verify-fairness"
                className="btn-secondary btn-sm"
                onClick={handleVerify}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <span className="spinner" />
                    Verifying Proof…
                  </>
                ) : (
                  <>
                    <IconCheck size={13} />
                    Run On-Chain Fairness Check
                  </>
                )}
              </button>
            </div>

            {error && <p className="form-status err" style={{ marginTop: 10 }}>{error}</p>}
            {statusMsg && <p className="form-status ok" style={{ marginTop: 10 }}>{statusMsg}</p>}
            {fairnessResult !== null && (
              <div
                className={`fairness-result ${fairnessResult ? 'ok' : 'err'}`}
                style={{ marginTop: 12 }}
              >
                {fairnessResult ? (
                  <>
                    <IconCheck size={16} />
                    <div>
                      <strong>Fairness Cryptographically Verified</strong>
                      <p>
                        The Midnight <code>verify_fairness()</code> circuit executed against ledger commitments confirms that Vendor #{rfp.winnerIndex} submitted the lowest bid, and all evaluation rules were satisfied without price leakage.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <IconShield size={16} />
                    <div>
                      <strong>Verification Failed</strong>
                      <p>Could not verify proof consistency on ledger.</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
