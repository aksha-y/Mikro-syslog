const crypto = require('crypto');

function getKey() {
  const secret = process.env.CRED_ENC_KEY || process.env.JWT_SECRET || 'fallback_secret_change_me';
  return crypto.scryptSync(secret, 'mikrotik-cred-v1', 32); // 32 bytes for AES-256
}

function encrypt(text) {
  const iv = crypto.randomBytes(12); // GCM recommended 12 bytes
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${ciphertext.toString('base64')}.${tag.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload) return '';
  const [ivB64, ctB64, tagB64] = String(payload).split('.');
  if (!ivB64 || !ctB64 || !tagB64) return '';
  const iv = Buffer.from(ivB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  return out;
}

module.exports = { encrypt, decrypt };