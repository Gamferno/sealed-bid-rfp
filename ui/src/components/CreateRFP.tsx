import { useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { ContractService } from '../contractService';
import { IconCheck, IconFile, IconLock, IconShield, IconSparkles } from './Icons';

type Props = {
  wallet: ConnectedAPI | null;
  walletAddress: string;
  contractAddress: string;
  onCreated: (address: string) => void;
};

type Preset = 'demo' | 'standard' | 'enterprise' | 'custom';

export function CreateRFP({ wallet, walletAddress, contractAddress: _contractAddress, onCreated }: Props) {
  const [description, setDescription] = useState('Procurement of Enterprise Cloud Infrastructure & Security Services');
  const [preset, setPreset] = useState<Preset>('demo');
  const [commitDurationMinutes, setCommitDurationMinutes] = useState('2');
  const [revealDurationMinutes, setRevealDurationMinutes] = useState('2');
  const [minBid, setMinBid] = useState('100');
  const [maxBid, setMaxBid] = useState('10000');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePresetSelect = (p: Preset) => {
    setPreset(p);
    if (p === 'demo') {
      setCommitDurationMinutes('2');
      setRevealDurationMinutes('2');
      setMinBid('100');
      setMaxBid('10000');
    } else if (p === 'standard') {
      setCommitDurationMinutes('60');
      setRevealDurationMinutes('60');
      setMinBid('500');
      setMaxBid('50000');
    } else if (p === 'enterprise') {
      setCommitDurationMinutes('1440');
      setRevealDurationMinutes('1440');
      setMinBid('1000');
      setMaxBid('250000');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet && !walletAddress) {
      setError('Please connect your Midnight wallet first.');
      return;
    }

    const minNum = BigInt(minBid || '0');
    const maxNum = BigInt(maxBid || '0');
    if (minNum >= maxNum) {
      setError('Minimum bid must be strictly lower than maximum budget cap.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus('Compiling parameters & deploying Compact smart contract to Midnight Preprod…');

    try {
      const commitSec = Math.max(30, Math.round(Number(commitDurationMinutes) * 60));
      const revealSec = Math.max(30, Math.round(Number(revealDurationMinutes) * 60));

      const result = await ContractService.createRFP({
        description: description.trim(),
        commitDurationSeconds: commitSec,
        revealDurationSeconds: revealSec,
        minBid: minNum,
        maxBid: maxNum,
        creatorAddress: walletAddress,
        wallet,
      });

      setStatus(`Smart contract deployed successfully: ${result.contractAddress.slice(0, 16)}…`);
      onCreated(result.contractAddress);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to deploy RFP contract');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="create-rfp" className="studio-layout">
      {/* Left Column: Form Controls */}
      <div className="card studio-form-card">
        <div className="card-header">
          <div className="card-title">
            <span className="title-icon">
              <IconFile size={18} />
            </span>
            <div>
              <h2>Create Sealed-Bid RFP Round</h2>
              <p className="card-sub">
                Initialize an enterprise tender on the Midnight ledger. Vendors seal bids via ZK commitments.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          {/* Quick Presets */}
          <div className="field">
            <span className="field-label-row">
              <span>Timeline Presets</span>
              <span className="preset-hint">Fast setup for demo &amp; testing</span>
            </span>
            <div className="preset-grid">
              <button
                type="button"
                className={`preset-btn ${preset === 'demo' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('demo')}
              >
                <IconSparkles size={13} />
                <strong>Demo Mode</strong>
                <small>2m Commit · 2m Reveal</small>
              </button>
              <button
                type="button"
                className={`preset-btn ${preset === 'standard' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('standard')}
              >
                <strong>Standard</strong>
                <small>1h Commit · 1h Reveal</small>
              </button>
              <button
                type="button"
                className={`preset-btn ${preset === 'enterprise' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('enterprise')}
              >
                <strong>Enterprise</strong>
                <small>24h Commit · 24h Reveal</small>
              </button>
              <button
                type="button"
                className={`preset-btn ${preset === 'custom' ? 'active' : ''}`}
                onClick={() => setPreset('custom')}
              >
                <strong>Custom</strong>
                <small>Manual bounds</small>
              </button>
            </div>
          </div>

          <label className="field">
            <span>Procurement Brief &amp; Scope</span>
            <textarea
              id="rfp-description"
              className="input textarea-brief"
              rows={3}
              placeholder="e.g. Procurement of High-Performance ZK Computing Infrastructure…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Commit Window (minutes)</span>
              <input
                id="commit-duration"
                className="input"
                type="number"
                step="0.5"
                min="0.5"
                value={commitDurationMinutes}
                onChange={(e) => {
                  setCommitDurationMinutes(e.target.value);
                  setPreset('custom');
                }}
                required
              />
              <span className="field-hint">Time for vendors to submit sealed hashes</span>
            </label>

            <label className="field">
              <span>Reveal Window (minutes)</span>
              <input
                id="reveal-duration"
                className="input"
                type="number"
                step="0.5"
                min="0.5"
                value={revealDurationMinutes}
                onChange={(e) => {
                  setRevealDurationMinutes(e.target.value);
                  setPreset('custom');
                }}
                required
              />
              <span className="field-hint">Time for vendors to submit ZK proofs</span>
            </label>

            <label className="field">
              <span>Minimum Bid (tDUST)</span>
              <input
                id="min-bid"
                className="input mono"
                type="number"
                min={0}
                value={minBid}
                onChange={(e) => {
                  setMinBid(e.target.value);
                  setPreset('custom');
                }}
                required
              />
            </label>

            <label className="field">
              <span>Maximum Budget Cap (tDUST)</span>
              <input
                id="max-bid"
                className="input mono"
                type="number"
                min={0}
                value={maxBid}
                onChange={(e) => {
                  setMaxBid(e.target.value);
                  setPreset('custom');
                }}
                required
              />
            </label>
          </div>

          {error && <p className="form-status err">{error}</p>}
          {status && <p className="form-status ok">{status}</p>}

          <button
            id="submit-rfp"
            className="btn-primary btn-deploy"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Deploying Contract to Midnight…
              </>
            ) : (
              <>
                <IconShield size={16} />
                Deploy Sealed RFP Smart Contract
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Column: Live Tender Preview Card */}
      <div className="card studio-preview-card">
        <div className="preview-header">
          <span className="preview-label">Live Tender Preview</span>
          <span className="badge badge-blue">Public Preview</span>
        </div>

        <div className="preview-content">
          <h3 className="preview-title">{description || 'Untitled Procurement Brief'}</h3>

          <div className="preview-meta-grid">
            <div className="preview-stat">
              <span className="stat-label">Commit Phase</span>
              <span className="stat-val mono">{commitDurationMinutes} min</span>
            </div>
            <div className="preview-stat">
              <span className="stat-label">Reveal Phase</span>
              <span className="stat-val mono">{revealDurationMinutes} min</span>
            </div>
            <div className="preview-stat">
              <span className="stat-label">Min Tender Bid</span>
              <span className="stat-val mono">{minBid || 0} tDUST</span>
            </div>
            <div className="preview-stat">
              <span className="stat-label">Budget Cap</span>
              <span className="stat-val mono">{maxBid || 0} tDUST</span>
            </div>
          </div>

          <div className="privacy-guarantee-box">
            <div className="privacy-box-title">
              <IconLock size={14} />
              <strong>Midnight Privacy Guarantees</strong>
            </div>
            <ul className="privacy-list">
              <li>
                <IconCheck size={12} /> Individual bid amounts stay in local browser storage.
              </li>
              <li>
                <IconCheck size={12} /> Only 32-byte Poseidon commitments are recorded on-chain.
              </li>
              <li>
                <IconCheck size={12} /> The winner is chosen in ZK — losing bid amounts are never revealed.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
