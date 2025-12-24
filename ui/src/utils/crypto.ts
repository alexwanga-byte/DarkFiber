import { getAddress, getBytes, hexlify, randomBytes } from "ethers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(addressKey: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available");
  }
  const addressBytes = getBytes(addressKey);
  const keyMaterial = await globalThis.crypto.subtle.digest("SHA-256", addressBytes);
  return globalThis.crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function createRandomAddress(): string {
  return getAddress(hexlify(randomBytes(20)));
}

export async function encryptMessage(plainText: string, addressKey: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(addressKey);
  const encoded = encoder.encode(plainText);
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptMessage(payload: string, addressKey: string): Promise<string> {
  const [version, ivBase64, dataBase64] = payload.split(":");
  if (version !== "v1" || !ivBase64 || !dataBase64) {
    throw new Error("Unsupported encryption payload");
  }
  const iv = fromBase64(ivBase64);
  const data = fromBase64(dataBase64);
  const key = await deriveKey(addressKey);
  const decrypted = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(decrypted);
}

export function normalizeDecryptedAddress(rawValue: string): string {
  if (rawValue.startsWith("0x")) {
    return getAddress(rawValue);
  }
  const numeric = BigInt(rawValue);
  const hexValue = `0x${numeric.toString(16).padStart(40, "0")}`;
  return getAddress(hexValue);
}
