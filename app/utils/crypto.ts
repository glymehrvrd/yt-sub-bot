import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXT_PUBLIC_CRYPTO_KEY || 'default-secret-key';

export function encrypt(text: string): string {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
