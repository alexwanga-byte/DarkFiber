import { useState, type FormEvent } from 'react';
import { Contract, isAddress } from 'ethers';
import { useAccount } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { createRandomAddress, encryptMessage } from '../utils/crypto';
import '../styles/MessageComposer.css';

type MessageComposerProps = {
  onSent: () => void;
};

export function MessageComposer({ onSent }: MessageComposerProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signer = useEthersSigner();
  const isContractConfigured = true;

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetStatus = () => {
    setError(null);
    setTxHash(null);
    setLastKey(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetStatus();

    if (!isContractConfigured) {
      setError('Contract address is not configured.');
      return;
    }

    if (!address) {
      setError('Connect your wallet before sending.');
      return;
    }

    if (!isAddress(recipient)) {
      setError('Enter a valid recipient address.');
      return;
    }

    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }

    if (!instance) {
      setError('Encryption service is not ready yet.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setError('Signer is not available.');
      return;
    }

    setIsSending(true);
    try {
      const oneTimeAddress = createRandomAddress();
      const cipherText = await encryptMessage(message.trim(), oneTimeAddress);

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(oneTimeAddress)
        .encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.sendMessage(recipient, cipherText, encryptedInput.handles[0], encryptedInput.inputProof);
      setTxHash(tx.hash);

      await tx.wait();
      setLastKey(oneTimeAddress);
      setMessage('');
      setRecipient('');
      onSent();
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : 'Failed to send message.';
      setError(messageText);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="composer">
      <div className="composer-header">
        <h3>Send a sealed message</h3>
        <p>Compose your note. A one-time address key is minted and encrypted with Zama FHE.</p>
      </div>

      <form className="composer-form" onSubmit={handleSubmit}>
        <label className="composer-label">
          Recipient address
          <input
            type="text"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="0x..."
            className="composer-input"
          />
        </label>
        <label className="composer-label">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the message you want to deliver..."
            className="composer-textarea"
            rows={5}
          />
        </label>
        <button className="composer-button" type="submit" disabled={isSending || zamaLoading}>
          {isSending ? 'Sending...' : 'Encrypt & Send'}
        </button>
      </form>

      <div className="composer-status">
        {zamaError && <p className="status-warning">{zamaError}</p>}
        {error && <p className="status-error">{error}</p>}
        {txHash && (
          <p className="status-info">
            Transaction submitted: <span>{txHash.slice(0, 10)}...</span>
          </p>
        )}
        {lastKey && (
          <p className="status-success">
            One-time address key minted: <span>{lastKey}</span>
          </p>
        )}
      </div>
    </section>
  );
}
