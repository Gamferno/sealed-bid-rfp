import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { useWallet } from './hooks/useWallet';
import { useRFP } from './hooks/useRFP';
import { CreateRFP } from './components/CreateRFP';
import { SubmitBid } from './components/SubmitBid';
import { RevealBid } from './components/RevealBid';
import { Results } from './components/Results';
import { WalletModal } from './components/WalletModal';
import { LedgerInspectorModal } from './components/LedgerInspectorModal';
import { ContractService } from './contractService';
import { openMidnightExplorer } from './utils/explorer';
import {
  IconClock,
  IconCode,
  IconCopy,
  IconExternal,
  IconEye,
  IconFile,
  IconLock,
  IconLogout,
  IconShield,
  IconSparkles,
  IconTrophy,
  IconUnlock,
  IconWallet,
  IconX,
} from './components/Icons';
import './App.css';

type Page = 'create' | 'bid' | 'reveal' | 'results';

const LAST_CONTRACT_KEY = 'midnight_last_active_rfp_address';
const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
export const DEFAULT_PREPROD_CONTRACT = '9922d2c2fa4467bd04463fd870c6b76073d6a4ab21b8531a4f20a6a01ca54268';

const STEPS: { page: Page; stepNum: string; label: string; icon: (p: { size?: number }) => ReactElement }[] = [
  { page: 'create', stepNum: '01', label: 'Create RFP', icon: IconFile },
  { page: 'bid', stepNum: '02', label: 'Seal Bid', icon: IconLock },
  { page: 'reveal', stepNum: '03', label: 'ZK Reveal', icon: IconUnlock },
  { page: 'results', stepNum: '04', label: 'Settle & Audit', icon: IconTrophy },
];

function truncAddr(addr: string): string {
  if (!addr) return '';
  return addr.length <= 18 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const {
    walletState,
    wallet,
    walletName,
    installedWallets,
    address,
    error: walletError,
    connect,
    disconnect,
    clearError,
  } = useWallet();

  const [page, setPage] = useState<Page>('bid');
  const [contractAddress, setContractAddress] = useState(() =>
    localStorage.getItem(LAST_CONTRACT_KEY) ?? DEFAULT_PREPROD_CONTRACT,
  );
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [inspectorModalOpen, setInspectorModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [inputAddress, setInputAddress] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const { rfp } = useRFP(contractAddress || null);
  const isConnected = walletState === 'connected';

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const handleContractAddressChange = (addr: string) => {
    const clean = addr.trim();
    setContractAddress(clean);
    if (clean) {
      localStorage.setItem(LAST_CONTRACT_KEY, clean);
    } else {
      localStorage.removeItem(LAST_CONTRACT_KEY);
    }
    setEditingAddress(false);
  };

  const copyContractAddress = async () => {
    if (!contractAddress) return;
    try {
      await navigator.clipboard.writeText(contractAddress);
      showToast('Contract address copied');
    } catch {
      showToast('Copy failed — select and copy manually');
    }
  };

  const handleAdvanceEarly = async () => {
    if (!contractAddress || !address) return;
    try {
      await ContractService.finalizeCommitPhaseEarly({ contractAddress, callerAddress: address });
      showToast('Commit phase closed early');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to advance phase');
    }
  };

  // Sync contract address across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LAST_CONTRACT_KEY && e.newValue && e.newValue !== contractAddress) {
        setContractAddress(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [contractAddress]);

  const navBadge = (p: Page): number | null => {
    if (p === 'bid') return rfp.totalVendors > 0 ? rfp.totalVendors : null;
    if (p === 'reveal') return rfp.revealedCount > 0 ? rfp.revealedCount : null;
    return null;
  };

  const isStepActiveForPhase = (p: Page): boolean => {
    if (p === 'create') return !contractAddress;
    if (p === 'bid') return rfp.phase === 'Committing';
    if (p === 'reveal') return rfp.phase === 'Revealing';
    if (p === 'results') return rfp.phase === 'Closed' || rfp.winnerIndex !== null;
    return false;
  };

  return (
    <div className="app">
      {/* ── Top Unified Command Header ─────────────────────── */}
      <header className="command-header">
        <div className="brand-section">
          <div className="brand-mark">
            <IconShield size={18} />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <span className="brand-name">Sealed-Bid RFP</span>
              <span className="net-chip">{NETWORK_ID}</span>
            </div>
            <span className="brand-tag">Private Procurement on Midnight</span>
          </div>
        </div>

        {/* Center: Contract Pill & Quick Actions */}
        <div className="round-control-center">
          {contractAddress ? (
            <div className="round-pill">
              <span className="round-pill-tag">RFP</span>
              <span className="round-pill-addr mono" title={contractAddress}>
                {truncAddr(contractAddress)}
              </span>

              <button
                className="round-pill-btn"
                onClick={copyContractAddress}
                title="Copy contract address"
                aria-label="Copy contract address"
              >
                <IconCopy size={13} />
              </button>

              <button
                className="round-pill-btn highlight-explorer"
                onClick={() => openMidnightExplorer(contractAddress)}
                title="View in Midnight Explorer"
                aria-label="View in Midnight Explorer"
              >
                <IconExternal size={13} />
                <span className="btn-text-sm">Explorer</span>
              </button>

              <button
                className="round-pill-btn"
                onClick={() => setInspectorModalOpen(true)}
                title="Inspect On-Chain Ledger State"
                aria-label="Inspect On-Chain Ledger State"
              >
                <IconCode size={13} />
                <span className="btn-text-sm">Inspect</span>
              </button>

              <button
                className="round-pill-btn subtle"
                onClick={() => handleContractAddressChange('')}
                title="Switch/Leave round"
                aria-label="Leave round"
              >
                <IconX size={12} />
              </button>
            </div>
          ) : editingAddress ? (
            <div className="contract-inline-form">
              <input
                className="input input-sm mono"
                type="text"
                placeholder="Paste contract address…"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                autoFocus
              />
              <button
                className="btn-primary btn-sm"
                onClick={() => handleContractAddressChange(inputAddress)}
              >
                Join
              </button>
              <button
                className="btn-icon subtle"
                onClick={() => setEditingAddress(false)}
              >
                <IconX size={13} />
              </button>
            </div>
          ) : (
            <div className="no-round-prompt">
              <button
                className="btn-join-pill"
                onClick={() => {
                  setInputAddress('');
                  setEditingAddress(true);
                }}
              >
                <IconLock size={12} /> Join Existing Round
              </button>
              <span className="or-divider">or</span>
              <button
                className="btn-create-pill"
                onClick={() => setPage('create')}
              >
                <IconSparkles size={12} /> Create RFP
              </button>
            </div>
          )}
        </div>

        {/* Right: Live Phase Pill & Wallet Chip */}
        <div className="header-right-actions">
          {contractAddress && rfp.phase !== 'Unknown' && (
            <div className={`phase-badge phase-${rfp.phase.toLowerCase()}`}>
              <span className="phase-indicator-dot" />
              <span className="phase-name">{rfp.phase}</span>
              {rfp.phase !== 'Closed' && (
                <span className="phase-timer mono">
                  <IconClock size={11} /> {formatDuration(rfp.secondsLeft)}
                </span>
              )}
            </div>
          )}

          {isConnected && address ? (
            <div className="wallet-chip">
              <span className="status-dot" />
              <div className="wallet-chip-text">
                <span className="wallet-chip-addr mono">{truncAddr(address)}</span>
                <span className="wallet-chip-wallet">{walletName ?? 'Midnight Wallet'}</span>
              </div>
              <button
                className="btn-icon subtle"
                onClick={disconnect}
                title="Disconnect wallet"
                aria-label="Disconnect wallet"
              >
                <IconLogout size={13} />
              </button>
            </div>
          ) : (
            <button
              id="connect-wallet"
              className="btn-connect"
              onClick={() => setWalletModalOpen(true)}
            >
              <IconWallet size={14} />
              {walletState === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* ── Error bar ──────────────────────────────── */}
      {walletError && (
        <div className="error-bar" role="alert">
          <span>{walletError}</span>
          <button className="btn-icon subtle" onClick={clearError} aria-label="Dismiss">
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* ── Interactive 4-Step Lifecycle Stepper ───────── */}
      <nav className="lifecycle-stepper" aria-label="Procurement Lifecycle">
        {STEPS.map(({ page: p, stepNum, label, icon: Icon }) => {
          const isSelected = page === p;
          const isPhaseActive = isStepActiveForPhase(p);
          return (
            <button
              key={p}
              id={`nav-${p}`}
              className={`stepper-btn ${isSelected ? 'selected' : ''} ${isPhaseActive ? 'phase-current' : ''}`}
              onClick={() => setPage(p)}
            >
              <span className="step-number">{stepNum}</span>
              <span className="step-icon-wrap">
                <Icon size={14} />
              </span>
              <span className="step-label">{label}</span>
              {navBadge(p) !== null && <span className="nav-badge">{navBadge(p)}</span>}
              {isPhaseActive && <span className="live-dot" title="Active Lifecycle Phase" />}
            </button>
          );
        })}
      </nav>

      {/* ── Main Workspace ───────────────────────────── */}
      <main className="main-content">
        {!contractAddress && page !== 'create' ? (
          <div className="card empty-workspace-card">
            <div className="empty-state-icon">
              <IconLock size={28} />
            </div>
            <h2>No Active Procurement Round</h2>
            <p>
              Create a new sealed-bid RFP round or paste a contract address above to participate in an active tender.
            </p>
            <div className="empty-state-actions">
              <button className="btn-primary" onClick={() => setPage('create')}>
                <IconFile size={15} />
                Create New RFP Round
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setInputAddress('');
                  setEditingAddress(true);
                }}
              >
                Join Existing Round
              </button>
            </div>
            <div className="empty-state-hints">
              <span>
                <IconShield size={13} /> Zero-Knowledge Proofs (Midnight Compact)
              </span>
              <span>
                <IconEye size={13} /> Only Winning Slot Disclosed
              </span>
              <span>
                <IconClock size={13} /> Verifiable Lowest-Bid Auction
              </span>
            </div>
          </div>
        ) : (
          <>
            {page === 'create' && (
              <CreateRFP
                wallet={wallet}
                walletAddress={address ?? ''}
                contractAddress={contractAddress}
                onCreated={(addr) => {
                  handleContractAddressChange(addr);
                  setPage('bid');
                }}
              />
            )}
            {page === 'bid' && (
              <SubmitBid
                wallet={wallet}
                walletAddress={address ?? ''}
                contractAddress={contractAddress}
                rfp={rfp}
                onNavigateToReveal={() => setPage('reveal')}
              />
            )}
            {page === 'reveal' && (
              <RevealBid
                wallet={wallet}
                walletAddress={address ?? ''}
                contractAddress={contractAddress}
                rfp={rfp}
                onAdvanceEarly={handleAdvanceEarly}
                onNavigateToResults={() => setPage('results')}
              />
            )}
            {page === 'results' && (
              <Results
                wallet={wallet}
                walletAddress={address ?? ''}
                contractAddress={contractAddress}
                rfp={rfp}
                onOpenInspector={() => setInspectorModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-left">
          <span className="footer-mark">
            <IconShield size={13} />
          </span>
          <span>
            Sealed-Bid Procurement powered by{' '}
            <a href="https://midnight.network" target="_blank" rel="noopener noreferrer">
              Midnight
            </a>
          </span>
        </div>
        <div className="footer-right">
          {contractAddress && (
            <button
              className="footer-link-btn"
              onClick={() => openMidnightExplorer(contractAddress)}
            >
              <IconExternal size={12} /> Midnight Explorer
            </button>
          )}
          {contractAddress && (
            <button
              className="footer-link-btn"
              onClick={() => setInspectorModalOpen(true)}
            >
              <IconCode size={12} /> On-Chain Telemetry
            </button>
          )}
        </div>
      </footer>

      {/* ── Wallet Picker Modal ─────────────────────── */}
      <WalletModal
        open={walletModalOpen}
        installed={installedWallets}
        connecting={walletState === 'connecting'}
        onConnect={(key) => {
          connect(key).then(() => setWalletModalOpen(false));
        }}
        onClose={() => setWalletModalOpen(false)}
      />

      {/* ── On-Chain Ledger & Explorer Inspector ────── */}
      <LedgerInspectorModal
        open={inspectorModalOpen}
        contractAddress={contractAddress}
        rfp={rfp}
        onClose={() => setInspectorModalOpen(false)}
        onToast={showToast}
      />

      {/* ── Toast ───────────────────────────────────── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
