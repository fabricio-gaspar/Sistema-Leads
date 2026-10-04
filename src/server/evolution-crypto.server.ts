import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const encoded = process.env.EVOLUTION_ENCRYPTION_KEY;
  if (!encoded) throw new Error("EVOLUTION_ENCRYPTION_KEY não está configurada no servidor.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("EVOLUTION_ENCRYPTION_KEY deve ser uma chave AES-256 válida em base64.");
  }
  return key;
}

export function encryptEvolutionSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptEvolutionSecret(ciphertext: string): string {
  const encoded = Buffer.from(ciphertext, "base64");
  if (encoded.length < 29) throw new Error("Credencial Evolution GO inválida.");
  const iv = encoded.subarray(0, 12);
  const tag = encoded.subarray(12, 28);
  const encrypted = encoded.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
