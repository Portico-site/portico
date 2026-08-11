'use strict';
/**
 * Encryption at rest for the things worth encrypting: API keys and conversations.
 *
 * Electron's safeStorage hands the work to the operating system — DPAPI on Windows,
 * the Keychain on macOS, libsecret or kwallet on Linux. The key is derived from the
 * logged-in account, which has two consequences worth being plain about:
 *
 *   - Nobody has to remember a passphrase, and nothing can be lost by forgetting one.
 *   - Anyone who can log in as this user can decrypt it. This protects a stolen disk,
 *     a backup, a synced folder or another account on the same machine. It does not
 *     protect against someone who already controls your session.
 *
 * That is the honest boundary, and it is the same one every desktop password manager
 * draws. Encrypting further would mean a passphrase, and a passphrase means chats
 * that are lost for good when it is forgotten.
 *
 * Availability is not guaranteed. A Linux box with no keyring returns false from
 * isEncryptionAvailable(), and there the only choices are plaintext or refusing to
 * save at all. Losing someone's conversations to protect them is the worse failure,
 * so this falls back to plaintext and says so, rather than silently doing either.
 */
const MARKER = 'portico:v1:';

let safeStorage = null;
let available = null;

function init() {
  if (available !== null) return available;
  try {
    safeStorage = require('electron').safeStorage;
    available = !!(safeStorage && safeStorage.isEncryptionAvailable());
  } catch {
    available = false;
  }
  return available;
}

/** Is the OS able to encrypt for us? */
function isAvailable() { return init(); }

/**
 * Encrypt a string for storage. Returns plaintext unchanged when the OS cannot
 * help, so a caller never has to choose between losing data and writing something
 * it cannot read back.
 */
function seal(plain) {
  const text = String(plain == null ? '' : plain);
  if (!text || !init()) return text;
  try {
    return MARKER + safeStorage.encryptString(text).toString('base64');
  } catch {
    return text;
  }
}

/**
 * Decrypt a stored string. Anything without the marker is returned as it is, which
 * is what makes the upgrade from an existing plaintext install invisible: old files
 * keep working and are re-sealed the next time they are written.
 */
function open(stored) {
  const text = String(stored == null ? '' : stored);
  if (!text.startsWith(MARKER)) return text;
  if (!init()) return '';          // sealed on a machine that could, opened on one that cannot
  try {
    return safeStorage.decryptString(Buffer.from(text.slice(MARKER.length), 'base64'));
  } catch {
    return '';
  }
}

/** Was this value written encrypted? */
function isSealed(stored) { return String(stored || '').startsWith(MARKER); }

module.exports = { seal, open, isSealed, isAvailable, MARKER };
