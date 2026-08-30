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

  const minVendorsRequired = 2;
  const hasMinVendors = rfp.totalVendors >= minVendorsRequired;
  const allVendorsRevealed = hasMinVendors && rfp.revealedCount >= rfp.totalVendors;
  const canDetermineWinner =
    rfp.winnerIndex === null &&
    allVendorsRevealed;

  const handleDetermineWinner = async () => {
    if (!wallet) {
      setError('Please connect your Midnight wallet first — a real wallet is required to finalize the winner on-chain.');
      return;
    }
    if (!contractAddress) return;
    setDetermining(true);
    setError(null);
    try {
      const res = await ContractService.determineWinner({
        contractAddress,
        wallet,
        onStatus: setStatusMsg,
      });
      if (res !== null) {
        setStatusMsg(`Winner finalized on-chain! Winning slot: Vendor #${res.winnerSlot}`);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to finalize winner on-chain');
    } finally {
      setDetermining(false);
    }
  };

  const handleVerify = async () => {
    if (!contractAddress) return;
    setVerifying(true);
    setError(null);
    try {
      const valid = await ContractService.verifyFairness({
        contractAddress,
        onStatus: setStatusMsg,
      });
      setFairness(valid);
      setStatusMsg(valid ? 'Fairness proof verified on-chain via Midnight indexer.' : 'Verification failed.');
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const isComplete = rfp.winnerIndex !== null;

  return (
    <section id="results" className="card view-card">
      {!isComplete ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <IconSparkles size={36} />
          </div>
          <h2>
            {rfp.phase === 'Committing'
              ? 'Commit Phase in Progress'
              : allVendorsRevealed
              ? 'Ready for ZK Winner Settlement'
              : 'Awaiting Vendor Reveals'}
          </h2>
          <p>
            {rfp.phase === 'Committing'
              ? 'Vendors are sealing their commitments. Settlement opens once bids are revealed.'
              : allVendorsRevealed
              ? `All ${rfp.totalVendors} participating vendor(s) have revealed their commitments. You can now execute the ZK circuit to determine the lowest bidder.`
              : `${rfp.revealedCount} of ${Math.max(rfp.totalVendors, minVendorsRequired)} vendors have revealed. The on-chain Compact circuit requires at least 2 vendor slots to submit & reveal before computing the minimum bidder.`}
          </p>

          {canDetermineWinner ? (
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
          ) : (
            rfp.phase !== 'Committing' && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.85rem', color: '#94a3b8' }}>
                💡 <strong>Next Step:</strong> Go to the <strong>Submit Bid</strong> and <strong>Reveal Bid</strong> tabs to submit commitments and reveals for remaining vendor slots (minimum 2 vendors required).
              </div>
            )
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
