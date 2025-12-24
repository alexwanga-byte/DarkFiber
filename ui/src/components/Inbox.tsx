import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { decryptMessage, normalizeDecryptedAddress } from '../utils/crypto';
import '../styles/Inbox.css';

type InboxProps = {
  refreshIndex: number;
};

type MessageItem = {
  id: bigint;
  sender: string;
  recipient: string;
  cipherText: string;
  encryptedKey: string;
  timestamp: number;
};

type DecryptedMessage = {
  keyAddress: string;
  plainText: string;
};

export function Inbox({ refreshIndex }: InboxProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signer = useEthersSigner();
  const isContractConfigured = true;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptingId, setDecryptingId] = useState<bigint | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedMessage>>({});

  const { data: inboxIds, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getInbox',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isContractConfigured,
    },
  });

  useEffect(() => {
    if (refreshIndex > 0) {
      refetch();
    }
  }, [refreshIndex, refetch]);

  useEffect(() => {
    if (!address || !publicClient || !inboxIds || !isContractConfigured) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const ids = [...(inboxIds as bigint[])].reverse();
        const results = await Promise.all(
          ids.map(async (id) => {
            const [sender, recipient, cipherText, encryptedKey, timestamp] = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'getMessage',
              args: [id],
            });

            return {
              id,
              sender,
              recipient,
              cipherText,
              encryptedKey: encryptedKey as string,
              timestamp: Number(timestamp),
            } as MessageItem;
          }),
        );

        setMessages(results);
      } catch (error) {
        console.error('Failed to load messages', error);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [address, inboxIds, publicClient, isContractConfigured]);

  const sortedMessages = useMemo(() => {
    return messages.slice().sort((a, b) => b.timestamp - a.timestamp);
  }, [messages]);

  const handleDecrypt = async (message: MessageItem) => {
    if (!instance || !address) {
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      return;
    }

    setDecryptingId(message.id);
    try {
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: message.encryptedKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const rawKey = result[message.encryptedKey as string] as string;
      const addressKey = normalizeDecryptedAddress(rawKey);
      const plainText = await decryptMessage(message.cipherText, addressKey);

      setDecrypted((prev) => ({
        ...prev,
        [message.id.toString()]: {
          keyAddress: addressKey,
          plainText,
        },
      }));
    } catch (error) {
      console.error('Decryption failed', error);
    } finally {
      setDecryptingId(null);
    }
  };

  if (!address) {
    return (
      <section className="inbox empty">
        <h3>Your inbox</h3>
        <p>Connect a wallet to see messages sent to you.</p>
      </section>
    );
  }

  if (!isContractConfigured) {
    return (
      <section className="inbox empty">
        <h3>Your inbox</h3>
        <p>Contract address is not configured yet.</p>
      </section>
    );
  }

  return (
    <section className="inbox">
      <div className="inbox-header">
        <h3>Your inbox</h3>
        <p>Encrypted messages addressed to {address.slice(0, 6)}...{address.slice(-4)}</p>
      </div>

      {loading && <p className="inbox-loading">Loading messages...</p>}

      {!loading && sortedMessages.length === 0 && (
        <div className="inbox-empty">
          <p>No messages yet.</p>
          <span>Ask someone to send you a sealed message.</span>
        </div>
      )}

      <div className="inbox-list">
        {sortedMessages.map((message, index) => {
          const decryptedMessage = decrypted[message.id.toString()];
          return (
            <article
              className="message-card"
              key={message.id.toString()}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="message-meta">
                <div>
                  <span className="meta-label">From</span>
                  <span className="meta-value">{message.sender}</span>
                </div>
                <div>
                  <span className="meta-label">Received</span>
                  <span className="meta-value">
                    {new Date(message.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="message-body">
                <p className="cipher-label">Ciphertext</p>
                <p className="cipher-text">{message.cipherText}</p>
              </div>

              {decryptedMessage ? (
                <div className="message-decrypted">
                  <div>
                    <span className="meta-label">One-time key</span>
                    <span className="meta-value">{decryptedMessage.keyAddress}</span>
                  </div>
                  <div>
                    <span className="meta-label">Message</span>
                    <p className="plain-text">{decryptedMessage.plainText}</p>
                  </div>
                </div>
              ) : (
                <button
                  className="message-button"
                  onClick={() => handleDecrypt(message)}
                  disabled={decryptingId === message.id}
                >
                  {decryptingId === message.id ? 'Decrypting...' : 'Decrypt message'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
