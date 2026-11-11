const openpgp = require('openpgp');

// The PGP public key customers can encrypt their delivery address to (setting
// pgp_public_key). Only the public key is stored: the shop decrypts with its
// private key, in the admin's browser, never on the server.

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// A pasted public key, checked and normalized; '' clears it
async function readPublicKey(text) {
  const armored = String(text || '').trim();
  if (!armored) return '';
  if (/PRIVATE KEY BLOCK/.test(armored)) {
    throw fail('This is a PRIVATE key: never paste it here. Paste the PUBLIC key (it starts with -----BEGIN PGP PUBLIC KEY BLOCK-----).');
  }
  let key;
  try { key = await openpgp.readKey({ armoredKey: armored }); }
  catch { throw fail('This is not a valid PGP public key. Paste the whole block, from -----BEGIN PGP PUBLIC KEY BLOCK----- to -----END PGP PUBLIC KEY BLOCK-----.'); }
  if (key.isPrivate()) throw fail('This is a PRIVATE key: paste the PUBLIC key instead.');
  try { await key.getEncryptionKey(); }
  catch { throw fail('This key cannot encrypt (it is expired, revoked or has no encryption subkey).'); }
  return key.armor().trim();
}

// A whole ASCII-armored PGP message (header lines allowed, then base64 and its checksum)
function isPgpMessage(t) {
  const m = String(t || '').trim().match(/^-----BEGIN PGP MESSAGE-----([\s\S]+)-----END PGP MESSAGE-----$/);
  if (!m) return false;
  const body = m[1].split(/\r?\n/).filter(l => !/^[\w-]+:\s/.test(l)).join('').replace(/\s+/g, '');
  return body.length >= 40 && /^[A-Za-z0-9+/]+=*(=[A-Za-z0-9+/]{4})?$/.test(body);
}

module.exports = { readPublicKey, isPgpMessage };
