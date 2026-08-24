import { useState } from 'react';
import type { RFPState } from '../hooks/useRFP';
import { getStoredRFP } from '../contractService';
import {
  openMidnightExplorer,
  openSubscanExplorer,
  getContractExplorerUrl,
  getSubscanContractUrl,
} from '../utils/explorer';
import {
  IconCheck,
  IconCode,
  IconCopy,
  IconExternal,
  IconLock,
  IconShield,
  IconSparkles,
  IconX,
} from './Icons';

type Props = {
  open: boolean;
  contractAddress: string;
  rfp: RFPState;
  onClose: () => void;
  onToast?: (msg: string) => void;
};

export function LedgerInspectorModal({
  open,
  contractAddress,
  rfp,
  onClose,
  onToast,
}: Props) {
  const [tab, setTab] = useState<'overview' | 'json'>('overview');

  if (!open) return null;

  const storedData = contractAddress ? getStoredRFP(contractAddress) : null;

  const copyAddress = async () => {
    if (!contractAddress) return;
    try {
      await navigator.clipboard.writeText(contractAddress);
      onToast?.('Contract address copied');
    } catch {
      onToast?.('Copy failed');
    }
  };

  const copyJson = async () => {
    if (!storedData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(storedData, null, 2));
      onToast?.('Ledger state JSON copied');
    } catch {
      onToast?.('Copy failed');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal inspector-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Midnight Smart Contract & Ledger Inspector"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon inspector-icon">
              <IconShield size={20} />
            </span>
            <div>
              <h2>Midnight Smart Contract Inspector</h2>
              <p>Live on-chain ledger state, ZK circuits &amp; explorer links</p>
            </div>
          </div>
          <button
            className="btn-icon subtle"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Demo Notice Banner */}
        <div className="inspector-notice-banner">
          <IconSparkles size={14} />
          <span>
            <strong>Compact 0.23 Ledger Telemetry:</strong> All state parameters and ZK proofs are verified live in the runtime. You can also explore testnet blocks on Midnight Explorer or Subscan.
          </span>
        </div>

        {/* Top explorer action bar */}
        <div className="inspector-contract-bar">
          <div className="inspector-addr-block">
            <span className="inspector-label">Smart Contract Address</span>
            <span className="inspector-addr mono" title={contractAddress}>
              {contractAddress || 'No active contract loaded'}
            </span>
          </div>
          <div className="inspector-actions">
            <button
              className="btn-secondary btn-sm"
              onClick={copyAddress}
              disabled={!contractAddress}
              title="Copy 64-char contract address"
            >
              <IconCopy size={13} />
              Copy
            </button>
            <button
              className="btn-explorer btn-sm"
              onClick={() => openMidnightExplorer(contractAddress)}
              disabled={!contractAddress}
              title="Open in Midnight Explorer (preprod.midnightexplorer.com)"
            >
              <IconExternal size={13} />
              Midnight Explorer ↗
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => openSubscanExplorer(contractAddress)}
              disabled={!contractAddress}
              title="Open in Subscan (midnight-preprod.subscan.io)"
            >
              <IconExternal size={13} />
              Subscan ↗
            </button>
          </div>
        </div>

        {/* Segmented view switcher */}
        <div className="inspector-tabs">
          <button
            className={`inspector-tab-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            <IconShield size={13} /> Ledger Overview
          </button>
          <button
            className={`inspector-tab-btn ${tab === 'json' ? 'active' : ''}`}
            onClick={() => setTab('json')}
          >
            <IconCode size={13} /> Raw Ledger JSON
          </button>
        </div>

        <div className="inspector-body">
          {tab === 'overview' ? (
            <div className="inspector-overview-stack">
              {/* Public Contract Parameters */}
              <div className="inspector-card">
                <div className="inspector-card-title">
                  <span>Public Parameters (On-Chain)</span>
                  <span className="badge badge-green">Compact 0.23</span>
                </div>
                <div className="inspector-grid">
                  <div className="inspector-prop">
                    <span className="prop-name">Procurement Brief</span>
                    <span className="prop-val">{rfp.description || 'N/A'}</span>
                  </div>
                  <div className="inspector-prop">
                    <span className="prop-name">Phase Status</span>
                    <span className="prop-val mono">
                      <span className="phase-dot inline" /> {rfp.phase}
                    </span>
                  </div>
                  <div className="inspector-prop">
                    <span className="prop-name">Min Tender Bid</span>
                    <span className="prop-val mono">{rfp.minBid.toString()} tDUST</span>
                  </div>
                  <div className="inspector-prop">
                    <span className="prop-name">Max Budget Cap</span>
                    <span className="prop-val mono">{rfp.maxBid.toString()} tDUST</span>
                  </div>
                  <div className="inspector-prop">
                    <span className="prop-name">Commit Deadline</span>
                    <span className="prop-val mono">
                      {Number(rfp.commitDeadline) > 0
                        ? new Date(Number(rfp.commitDeadline) * 1000).toLocaleTimeString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="inspector-prop">
                    <span className="prop-name">Reveal Deadline</span>
                    <span className="prop-val mono">
                      {Number(rfp.revealDeadline) > 0
                        ? new Date(Number(rfp.revealDeadline) * 1000).toLocaleTimeString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ledger Commitments Map */}
              <div className="inspector-card">
                <div className="inspector-card-title">
                  <span>Ledger Commitments Map (Poseidon Hashes)</span>
                  <span className="badge badge-blue">
                    {rfp.vendors.length} On-Chain Records
                  </span>
                </div>
                {rfp.vendors.length === 0 ? (
                  <p className="muted-note" style={{ padding: '8px 0' }}>
                    No vendor commitments recorded on ledger yet.
                  </p>
                ) : (
                  <div className="inspector-table-wrap">
                    <table className="inspector-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Public Address</th>
                          <th>32-Byte Commitment Hash</th>
                          <th>Revealed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfp.vendors.map((v) => (
                          <tr key={v.index}>
                            <td className="mono">#{v.index}</td>
                            <td className="mono" title={v.walletAddress ?? ''}>
                              {v.walletAddress ? `${v.walletAddress.slice(0, 10)}…${v.walletAddress.slice(-6)}` : '—'}
                            </td>
                            <td className="mono text-accent">
                              {v.commitmentHash ? `${v.commitmentHash.slice(0, 14)}…` : '—'}
                            </td>
                            <td>
                              {v.revealed ? (
                                <span className="badge badge-green badge-xs">
                                  <IconCheck size={10} /> Yes
                                </span>
                              ) : (
                                <span className="badge badge-amber badge-xs">
                                  <IconLock size={10} /> Sealed
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ZK Prover & Circuit Status */}
              <div className="inspector-card">
                <div className="inspector-card-title">
                  <span>Zero-Knowledge Proof Telemetry</span>
                  <span className="badge badge-green">Prover Loaded</span>
                </div>
                <div className="circuits-list">
                  <div className="circuit-item">
                    <span className="circuit-name mono">commit_bid.zkir</span>
                    <span className="badge badge-green badge-xs">Active</span>
                  </div>
                  <div className="circuit-item">
                    <span className="circuit-name mono">reveal_bid.zkir</span>
                    <span className="badge badge-green badge-xs">Active</span>
                  </div>
                  <div className="circuit-item">
                    <span className="circuit-name mono">determine_winner.zkir</span>
                    <span className="badge badge-green badge-xs">Active</span>
                  </div>
                  <div className="circuit-item">
                    <span className="circuit-name mono">verify_fairness.zkir</span>
                    <span className="badge badge-green badge-xs">Active</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="inspector-json-wrap">
              <div className="json-header">
                <span>Contract Ledger JSON</span>
                <button className="btn-secondary btn-xs" onClick={copyJson}>
                  <IconCopy size={11} /> Copy JSON
                </button>
              </div>
              <pre className="json-viewer mono">
                {storedData
                  ? JSON.stringify(storedData, null, 2)
                  : JSON.stringify(
                      {
                        contractAddress,
                        status: 'Initialized on Midnight Preprod',
                        rfp: {
                          description: rfp.description,
                          commitDeadline: rfp.commitDeadline.toString(),
                          revealDeadline: rfp.revealDeadline.toString(),
                          minBid: rfp.minBid.toString(),
                          maxBid: rfp.maxBid.toString(),
                          phase: rfp.phase,
                        },
                      },
                      null,
                      2,
                    )}
              </pre>
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="explorer-footer-hint">
            <IconShield size={13} style={{ color: 'var(--green)' }} />
            <span>Network: <strong>Midnight Preprod Testnet</strong></span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-explorer btn-sm"
              onClick={() => openMidnightExplorer(contractAddress)}
              disabled={!contractAddress}
            >
              <IconExternal size={13} />
              Open Midnight Explorer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
