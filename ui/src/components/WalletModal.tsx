import { useEffect } from 'react';
import {
  KNOWN_WALLETS,
  WALLET_INSTALL_LINKS,
  type InstalledWallet,
} from '../hooks/useWallet';
import { IconExternal, IconWallet, IconX } from './Icons';

type Props = {
  open: boolean;
  installed: InstalledWallet[];
  connecting: boolean;
  onConnect: (key: string) => void;
  onClose: () => void;
};

export function WalletModal({ open, installed, connecting, onConnect, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const installedKeys = new Set(installed.map(w => w.key));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect a wallet"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon"><IconWallet size={18} /></span>
            <div>
              <h2>Connect a wallet</h2>
              <p>Choose a Midnight wallet to participate in sealed-bid rounds.</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>

        {installed.length > 0 ? (
          <div className="wallet-list">
            {installed.map(w => (
              <button
                key={w.key}
                className="wallet-option"
                onClick={() => onConnect(w.key)}
                disabled={connecting}
              >
                <span className="wallet-logo">
                  {w.icon ? (
                    <img src={w.icon} alt="" width={24} height={24} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                  ) : (
                    <IconWallet size={22} />
                  )}
                </span>
                <span className="wallet-option-name">
                  <strong>{w.name}</strong>
                  <small>Detected in this browser</small>
                </span>
                <span className="wallet-option-cta">{connecting ? 'Connecting…' : 'Connect'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="wallet-empty">
            <IconWallet size={28} />
            <p>
              No Midnight wallet detected. Install one of the options below and
              refresh this page.
            </p>
          </div>
        )}

        <div className="modal-footer">
          <span className="modal-footer-label">Don't have a wallet?</span>
          <div className="wallet-install-row">
            {Object.entries(KNOWN_WALLETS).map(([key, meta]) => (
              <a
                key={key}
                className={`install-chip ${installedKeys.has(key) ? 'installed' : ''}`}
                href={WALLET_INSTALL_LINKS[key]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {meta.name}
                {installedKeys.has(key) ? (
                  <span className="install-chip-state">Installed</span>
                ) : (
                  <IconExternal size={12} />
                )}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
