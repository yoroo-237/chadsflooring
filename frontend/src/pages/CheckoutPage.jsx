import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { fingerprint, encryptTo } from '../utils/pgp';

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const COIN_NAMES = { BTC: 'Bitcoin', LTC: 'Litecoin', DOGE: 'Dogecoin', ETH: 'Ethereum', XMR: 'Monero' };

const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'],
  ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];
const EMPTY_ADDRESS = { name: '', street: '', apt: '', city: '', state: '', zip: '' };

// Kept on this device only, to prefill the next delivery (never an encrypted one)
function loadAddress() {
  try { return { ...EMPTY_ADDRESS, ...JSON.parse(localStorage.getItem('ce_address') || '{}') }; } catch { return EMPTY_ADDRESS; }
}

// Checkout: paid from the wallet balance, or straight in crypto to the order's own
// address. Nothing is required: Telegram (when the profile has none), delivery and
// the refund address are all optional. Choosing delivery asks for a US address,
// adds shipping, and can encrypt the address to the shop's PGP key in this browser.
export default function CheckoutPage() {
  const { cartItems, placeOrder, payOrder, balance, holdings, settings, user, setUser, depositFeePct } = useApp();
  const navigate = useNavigate();

  const [method, setMethod]           = useState('wallet'); // 'wallet' | 'crypto'
  const [payCurrency, setPayCurrency] = useState('');
  const [coins, setCoins]             = useState(null);
  const [coin, setCoin]               = useState('');
  const [payWindow, setPayWindow]     = useState(30);
  const [telegram, setTelegram]       = useState('');
  const askTelegram = !user?.telegramHandle;

  const [delivery, setDelivery] = useState(false);
  const [address, setAddress]   = useState(loadAddress);
  const [touched, setTouched]   = useState(false);
  const shopKey = settings?.pgp_public_key?.trim() || '';
  const [encrypt, setEncrypt]   = useState(true);
  const [keyPrint, setKeyPrint] = useState(null);
  useEffect(() => { if (shopKey && delivery) fingerprint(shopKey).then(setKeyPrint); }, [shopKey, delivery]);
  const encrypting = !!(shopKey && encrypt && keyPrint);

  // Optional: where the shop sends money back should the order be refunded
  const [refund, setRefund] = useState({ currency: 'BTC', address: '' });
  useEffect(() => {
    if (user?.btcRefundAddress) setRefund(r => (r.address ? r : { currency: 'BTC', address: user.btcRefundAddress }));
    else if (user?.xmrRefundAddress) setRefund(r => (r.address ? r : { currency: 'XMR', address: user.xmrRefundAddress }));
  }, [user?.btcRefundAddress, user?.xmrRefundAddress]);

  const [placing, setPlacing]     = useState(false);
  const [placed, setPlaced]       = useState(null);
  const [serverErr, setServerErr] = useState('');

  useEffect(() => {
    api.get('/orders/payable-coins')
      .then(d => { setCoins(d.coins || []); setPayWindow(d.payWindowMinutes || 30); setCoin(c => c || d.coins?.[0] || ''); })
      .catch(() => setCoins([]));
  }, []);

  // Paid in crypto: a refund goes back in the coin paid, so the refund address is that coin's
  useEffect(() => {
    if (method !== 'crypto' || !coin) return;
    setRefund(r => {
      if (r.currency === coin) return r;
      const saved = coin === 'BTC' ? user?.btcRefundAddress : coin === 'XMR' ? user?.xmrRefundAddress : '';
      return { currency: coin, address: saved || '' };
    });
  }, [method, coin, user?.btcRefundAddress, user?.xmrRefundAddress]);

  const shippingCost  = Number(settings?.shipping_cost           || 16.99);
  const freeThreshold = Number(settings?.shipping_free_threshold || 75);

  const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(String(item.price).replace(/[$P]/g, '')) || 0), 0);
  const shipIfDelivered = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : shippingCost;
  const shippingFee = delivery ? shipIfDelivered : 0;
  const total = subtotal + shippingFee;

  const payHolding = holdings.find(h => h.currency === payCurrency);
  const available = payHolding ? (payHolding.usd || 0) : balance;
  const hasEnoughBalance = available >= total;
  const cryptoPreview = payHolding?.price ? (total / payHolding.price).toFixed(8).replace(/0+$/, '') : null;

  const addrErrors = {
    name: !address.name.trim(), street: !address.street.trim(), city: !address.city.trim(),
    state: !address.state, zip: !/^\d{5}(-\d{4})?$/.test(address.zip.trim()),
  };
  const addressOk = !delivery || !Object.values(addrErrors).some(Boolean);
  const setA = k => e => setAddress(a => ({ ...a, [k]: k === 'zip' ? e.target.value.replace(/[^\d-]/g, '') : e.target.value }));
  const bad = k => touched && addrErrors[k];

  const canSubmit = method === 'wallet' ? hasEnoughBalance : !!coin;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!addressOk) { document.getElementById('delivery')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (!canSubmit) return;
    setPlacing(true); setServerErr('');
    try {
      const tg = askTelegram ? telegram.trim().replace(/^@/, '') : '';
      if (delivery && !encrypting) { try { localStorage.setItem('ce_address', JSON.stringify(address)); } catch { /* storage blocked */ } }
      let shipTo = delivery ? { ...address, zip: address.zip.trim() } : null;
      if (shipTo && encrypting) {
        const { name, street, apt, city, state, zip } = shipTo;
        shipTo = { pgp: await encryptTo(shopKey, [name, street, apt, `${city}, ${state} ${zip}`, 'United States'].filter(Boolean).join('\n')) };
      }
      if (shipTo && !shipTo.pgp && !shipTo.apt) delete shipTo.apt;
      const refundTo = refund.address.trim() ? { currency: refund.currency, address: refund.address.trim() } : undefined;
      const common = { telegram: tg || undefined, delivery: shipTo || undefined, refund: refundTo };

      if (method === 'crypto') {
        const data = await payOrder({ coin, ...common });
        if (tg) setUser(u => ({ ...u, telegramHandle: tg }));
        navigate(`/orders/${data.order.id}/pay`);
        return;
      }
      const order = await placeOrder({ payCurrency: payCurrency || undefined, ...common });
      if (tg) setUser(u => ({ ...u, telegramHandle: tg }));
      setPlaced(order);
    } catch (err) {
      setServerErr(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (cartItems.length === 0 && !placed) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="empty-state">
            <h3>Your cart is empty</h3>
            <p>Add some products before checking out.</p>
            <Link to="/" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Go to Shop</Link>
          </div>
        </div>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="order-success">
            <div className="order-success-icon"><CheckIcon /></div>
            <h1 className="order-success-title">Order Confirmed!</h1>
            <p className="order-success-sub">Order <strong>{placed.frontendId || placed.id}</strong></p>
            <p className="order-success-desc">
              Your order is paid and being prepared. {placed.shipAddress ? 'We’ll message you when it ships.' : 'The shop will reach you on Telegram to arrange it.'}
            </p>
            {placed.invoice && (
              <p className="order-success-desc">
                {placed.invoice.delivered ? 'Your invoice has been sent to the shop on Telegram.' : 'Open Telegram to send your invoice to the shop.'}
              </p>
            )}
            <div className="order-success-actions">
              {placed.invoice?.shopTelegramUrl && <a className="btn-primary tg-invoice-send" href={placed.invoice.shopTelegramUrl} target="_blank" rel="noreferrer">Open Telegram</a>}
              <Link to="/orders" className="btn-primary">View Orders</Link>
              <Link to="/" className="btn-secondary">Continue Shopping</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="page-container">
        <div className="breadcrumb">
          <button className="breadcrumb-back" onClick={() => navigate(-1)}>
            <ArrowLeftIcon /> Back
          </button>
          <span className="breadcrumb-sep">/</span>
          <Link to="/" className="breadcrumb-link">Shop</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Checkout</span>
        </div>

        <h1 className="page-title">Checkout</h1>

        {serverErr && <div className="checkout-error">{serverErr}</div>}

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>
            <div className="checkout-section">
              <h3 className="checkout-section-title">Payment</h3>
              <div className="co-options" role="radiogroup" aria-label="Payment method">
                <label className={`co-option${method === 'wallet' ? ' on' : ''}`}>
                  <input type="radio" name="method" checked={method === 'wallet'} onChange={() => setMethod('wallet')} />
                  <span><b>Wallet balance</b><small>Paid instantly from your credits</small></span>
                  <span className="co-amt">${balance.toFixed(2)}</span>
                </label>
                <label className={`co-option${method === 'crypto' ? ' on' : ''}${coins && !coins.length ? ' off' : ''}`}>
                  <input type="radio" name="method" checked={method === 'crypto'} disabled={coins && !coins.length} onChange={() => setMethod('crypto')} />
                  <span><b>Pay with crypto</b><small>{coins && !coins.length ? 'Unavailable right now' : `Send it from any wallet, ${payWindow} minutes to pay`}</small></span>
                </label>
              </div>

              {method === 'wallet' ? (
                <>
                  {holdings.length > 1 && (
                    <label className="checkout-pay-with">
                      <span>Pay with</span>
                      <select value={payCurrency} onChange={e => setPayCurrency(e.target.value)}>
                        <option value="">Automatic, largest balance first</option>
                        {holdings.map(h => (
                          <option key={h.currency} value={h.currency}>{h.currency}: {h.amount} (${(h.usd || 0).toFixed(2)})</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {cryptoPreview && <p className="checkout-rate-note">About {cryptoPreview} {payCurrency} at the current price.</p>}
                  <p className="checkout-rate-note">The total is converted at the live price when you place the order, and that amount of crypto is locked in.</p>
                  {!hasEnoughBalance && (
                    <div className="checkout-balance-error">
                      Not enough balance: {payHolding ? `your ${payCurrency}` : 'your wallet'} has ${available.toFixed(2)} and this order costs ${total.toFixed(2)}.{' '}
                      <Link to="/wallet">Top up your wallet</Link> or pay with crypto.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="co-coins" role="radiogroup" aria-label="Coin">
                    {(coins || []).map(c => (
                      <button type="button" key={c} className={`co-coin${coin === c ? ' on' : ''}`} onClick={() => setCoin(c)} aria-pressed={coin === c}>
                        {c} <small>{COIN_NAMES[c]}</small>
                      </button>
                    ))}
                  </div>
                  <p className="checkout-rate-note">
                    Next you get the order’s own {coin || 'crypto'} address and the exact amount to send, priced now.
                    {depositFeePct > 0 && <> It includes the {depositFeePct}% deposit fee.</>}
                    {' '}Pay within {payWindow} minutes, or the order is cancelled and anything received is refunded.
                    {coin === 'XMR' && ' Monero payments are checked by hand.'}
                  </p>
                </>
              )}
            </div>

            {askTelegram && (
              <div className="checkout-section">
                <h3 className="checkout-section-title">Telegram <span className="co-opt">(optional)</span></h3>
                <input className="checkout-tg-input" placeholder="@username or ID" autoComplete="off" value={telegram} onChange={e => setTelegram(e.target.value)} aria-label="Your Telegram username or ID" />
                <p className="checkout-rate-note">Added to your invoice so the shop can reach you, and saved to your profile.</p>
              </div>
            )}

            <div className="checkout-section" id="delivery">
              <h3 className="checkout-section-title">Delivery</h3>
              <div className="co-options" role="radiogroup" aria-label="Delivery">
                <label className={`co-option${delivery ? ' on' : ''}`}>
                  <input type="radio" name="delivery" checked={delivery} onChange={() => setDelivery(true)} />
                  <span><b>Ship it to me</b><small>Discreet, tracked shipping anywhere in the US</small></span>
                  <span className="co-amt">{shipIfDelivered ? `$${shipIfDelivered.toFixed(2)}` : 'Free'}</span>
                </label>
                <label className={`co-option${!delivery ? ' on' : ''}`}>
                  <input type="radio" name="delivery" checked={!delivery} onChange={() => setDelivery(false)} />
                  <span><b>No delivery</b><small>We’ll sort it out with you on Telegram</small></span>
                  <span className="co-amt">$0.00</span>
                </label>
              </div>

              {delivery && (
                <div className="co-address">
                  <div className="co-field">
                    <label htmlFor="a-name">Full name</label>
                    <input id="a-name" className={bad('name') ? 'invalid' : ''} autoComplete="shipping name" value={address.name} onChange={setA('name')} />
                    {bad('name') && <span className="co-err">Enter the name on the package</span>}
                  </div>
                  <div className="co-field">
                    <label htmlFor="a-street">Street address</label>
                    <input id="a-street" className={bad('street') ? 'invalid' : ''} autoComplete="shipping address-line1" placeholder="123 Main St" value={address.street} onChange={setA('street')} />
                    {bad('street') && <span className="co-err">Enter a street address</span>}
                  </div>
                  <div className="co-field">
                    <label htmlFor="a-apt">Apt, suite, unit <span className="co-opt">(optional)</span></label>
                    <input id="a-apt" autoComplete="shipping address-line2" value={address.apt} onChange={setA('apt')} />
                  </div>
                  <div className="co-row-3">
                    <div className="co-field">
                      <label htmlFor="a-city">City</label>
                      <input id="a-city" className={bad('city') ? 'invalid' : ''} autoComplete="shipping address-level2" value={address.city} onChange={setA('city')} />
                      {bad('city') && <span className="co-err">Required</span>}
                    </div>
                    <div className="co-field">
                      <label htmlFor="a-state">State</label>
                      <select id="a-state" className={bad('state') ? 'invalid' : ''} autoComplete="shipping address-level1" value={address.state} onChange={setA('state')}>
                        <option value="">Select</option>
                        {STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select>
                      {bad('state') && <span className="co-err">Required</span>}
                    </div>
                    <div className="co-field">
                      <label htmlFor="a-zip">ZIP code</label>
                      <input id="a-zip" className={bad('zip') ? 'invalid' : ''} inputMode="numeric" autoComplete="shipping postal-code" placeholder="12345" maxLength={10} value={address.zip} onChange={setA('zip')} />
                      {bad('zip') && <span className="co-err">5-digit ZIP</span>}
                    </div>
                  </div>
                  {shopKey && keyPrint && (
                    <div className="co-pgp">
                      <label className="co-pgp-toggle">
                        <input type="checkbox" checked={encrypt} onChange={e => setEncrypt(e.target.checked)} />
                        <span><b>Encrypt my address with PGP</b><small>Encrypted on this device with the shop’s key before it’s sent. Only the shop can read it.</small></span>
                      </label>
                      <details>
                        <summary>Shop key {keyPrint.split(' ').slice(-4).join(' ')}</summary>
                        <p className="checkout-rate-note">Fingerprint: <code>{keyPrint}</code></p>
                        <textarea className="co-pgp-key" readOnly rows={6} value={shopKey} onFocus={e => e.target.select()} aria-label="The shop's PGP public key" />
                      </details>
                    </div>
                  )}
                  <p className="checkout-rate-note">
                    Shipped in discreet, unmarked packaging. {encrypting ? 'Your address is encrypted: the shop receives it as a PGP message.' : 'Your address goes on the invoice the shop receives on Telegram.'}
                  </p>
                </div>
              )}
            </div>

            <div className="checkout-section">
              <h3 className="checkout-section-title">Refund address <span className="co-opt">(optional)</span></h3>
              <div className="co-refund">
                <div className="co-field">
                  <label htmlFor="rf-coin">Coin</label>
                  <select id="rf-coin" value={refund.currency} disabled={method === 'crypto'} onChange={e => setRefund(r => ({ ...r, currency: e.target.value }))}>
                    {Object.entries(COIN_NAMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </div>
                <div className="co-field">
                  <label htmlFor="rf-addr">Your {refund.currency} address</label>
                  <input id="rf-addr" autoComplete="off" spellCheck={false} placeholder="Leave empty if you prefer" value={refund.address} onChange={e => setRefund(r => ({ ...r, address: e.target.value }))} />
                </div>
              </div>
              <p className="checkout-rate-note">
                {method === 'crypto'
                  ? `Where we send ${refund.currency} back if a payment arrives late, short or too large, or if the order is refunded. Without it, refunds go to your wallet balance.`
                  : 'Only used should your order be refunded. It goes on your order.'}
              </p>
            </div>

            <button type="submit" className="btn-checkout-submit" disabled={placing || !canSubmit}>
              {placing ? 'Processing…' : method === 'crypto' ? `Continue to payment: $${total.toFixed(2)}` : `Place Order: $${total.toFixed(2)}`}
            </button>
            {touched && !addressOk && <p className="co-err" style={{ textAlign: 'center' }}>Please complete your delivery address.</p>}
          </form>

          <div className="checkout-summary">
            <h3 className="checkout-section-title">Order Summary</h3>
            <div className="summary-items">
              {cartItems.map((item, i) => (
                <div key={i} className="summary-item">
                  <img src={item.image} alt={item.name} className="summary-item-img" onError={e => { e.target.style.opacity = '0'; }} />
                  <div className="summary-item-info">
                    <div className="summary-item-brand">{item.brand}</div>
                    <div className="summary-item-name">{item.name}</div>
                  </div>
                  <div className="summary-item-price">{item.price}</div>
                </div>
              ))}
            </div>
            <div className="summary-totals">
              <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="summary-row">
                <span>Delivery</span>
                <span className={delivery && shippingFee === 0 ? 'text-green' : ''}>{!delivery ? 'None' : shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="summary-row summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
