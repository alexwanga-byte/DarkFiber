import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { Inbox } from './Inbox';
import { MessageComposer } from './MessageComposer';
import '../styles/DarkFiberApp.css';

export function DarkFiberApp() {
  const { address } = useAccount();
  const [refreshIndex, setRefreshIndex] = useState(0);

  const handleSent = () => {
    setRefreshIndex((current) => current + 1);
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <section className="hero">
          <div className="hero-card">
            <h2>Encrypted delivery with a disposable address key.</h2>
            <p>
              Compose a message, the app generates a fresh address, encrypts your text with it, and stores the key as
              an FHE ciphertext. Only the recipient can unlock the key and reveal the message.
            </p>
            <div className="hero-meta">
              <div>
                <span className="hero-label">Network</span>
                <span className="hero-value">Sepolia FHEVM</span>
              </div>
              <div>
                <span className="hero-label">Status</span>
                <span className="hero-value">{address ? 'Wallet connected' : 'Connect wallet to start'}</span>
              </div>
            </div>
          </div>
          <div className="hero-badge">
            <span>Powered by Zama Relayer</span>
          </div>
        </section>

        <section className="app-grid">
          <MessageComposer onSent={handleSent} />
          <Inbox refreshIndex={refreshIndex} />
        </section>
      </main>
    </div>
  );
}
