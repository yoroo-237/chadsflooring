import React, { useEffect, useState } from 'react';
import { fingerprint, generateKeyPair } from '../../utils/pgp';

const muted = { color: '#6c757d', fontSize: 13, margin: '6px 0 0' };
const alert = { background: 'rgba(229,57,53,.1)', color: '#c62828', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginTop: 8 };

// The shop's PGP public key, pasted or generated here, with its fingerprint to compare
// against your own copy. Generating makes the pair in this browser: the public key fills
// the field (onGenerated saves it), the private key is downloaded as a file locked with
// your passphrase. It never goes to the server: keep it, it is the only way to read the
// encrypted delivery addresses (an order, Decrypt).
export default function PgpKeyField({ value, onChange, onGenerated, name = 'Shop' }) {
  const [print, setPrint] = useState(null);
  const [gen, setGen] = useState(null); // { name, pass, pass2, busy, error }
  useEffect(() => { let on = true; fingerprint(value).then(p => on && setPrint(p)); return () => { on = false; }; }, [value]);
  const privateKey = /PRIVATE KEY BLOCK/.test(value || '');

  async function generate() {
    if (gen.pass.length < 10) return setGen(g => ({ ...g, error: 'Use a passphrase of at least 10 characters.' }));
    if (gen.pass !== gen.pass2) return setGen(g => ({ ...g, error: 'The two passphrases differ.' }));
    if ((value || '').trim() && !window.confirm('This replaces the current key. Addresses already encrypted to it can still only be read with its own private key. Continue?')) return;
    setGen(g => ({ ...g, busy: true, error: '' }));
    try {
      const pair = await generateKeyPair(gen.name.trim() || name, gen.pass);
      const url = URL.createObjectURL(new Blob([pair.privateKey], { type: 'application/pgp-keys' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'shop-pgp-private-key.asc' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onChange(pair.publicKey);
      setGen(null);
      if (onGenerated) await onGenerated(pair.publicKey);
    } catch (e) { setGen(g => ({ ...g, busy: false, error: e.message })); }
  }

  return (
    <div className="admin-form-group">
      <label className="admin-label">PGP public key</label>
      <textarea className="admin-input" rows={6} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={'-----BEGIN PGP PUBLIC KEY BLOCK-----\n…\n-----END PGP PUBLIC KEY BLOCK-----'} spellCheck={false} />
      {privateKey
        ? <div style={alert}>This is your PRIVATE key. Remove it and paste the PUBLIC key: anyone holding the private key can read every address.</div>
        : (value || '').trim() && <p style={muted}>{print ? <>Fingerprint: <code>{print}</code></> : 'Not a valid PGP public key yet.'}</p>}
      <p style={muted}>With a key, customers can encrypt their delivery address in their browser. Only you can read it, from the order, with your private key. Leave empty to turn it off.</p>

      {!gen ? (
        <button type="button" className="admin-btn admin-btn-sm" style={{ marginTop: 8 }} onClick={() => setGen({ name, pass: '', pass2: '', busy: false, error: '' })}>Generate a new key</button>
      ) : (
        <div style={{ marginTop: 10, padding: 12, border: '1px solid #ddd', borderRadius: 8, display: 'grid', gap: 8 }}>
          <div style={muted}>The key pair is made in this browser. The public key is saved here; the <b>private key is downloaded</b> as a file locked with your passphrase and never sent to the server. Keep the file and the passphrase safe: without them, the encrypted addresses can’t be read.</div>
          <input className="admin-input" placeholder="Name on the key" value={gen.name} onChange={e => setGen(g => ({ ...g, name: e.target.value }))} />
          <input className="admin-input" type="password" autoComplete="new-password" placeholder="Passphrase (10 characters or more)" value={gen.pass} onChange={e => setGen(g => ({ ...g, pass: e.target.value }))} />
          <input className="admin-input" type="password" autoComplete="new-password" placeholder="Passphrase again" value={gen.pass2} onChange={e => setGen(g => ({ ...g, pass2: e.target.value }))} />
          {gen.error && <div style={{ ...alert, marginTop: 0 }}>{gen.error}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={gen.busy} onClick={generate}>{gen.busy ? 'Generating…' : 'Generate and download the private key'}</button>
            <button type="button" className="admin-btn admin-btn-sm" disabled={gen.busy} onClick={() => setGen(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
