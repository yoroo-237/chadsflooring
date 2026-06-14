import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const STATIC_FAQS = [
  { q: 'How do I place an order?', a: 'Browse our products, add items to your cart, and click Checkout. Fill in your delivery information, choose a payment method, and click "Place Order". You\'ll receive a payment address and your order will be confirmed once the transaction is verified.' },
  { q: 'What payment methods do you accept?', a: 'We accept Monero (XMR), Bitcoin (BTC), Dogecoin (DOGE), and Litecoin (LTC). We currently do not accept traditional payment methods like credit cards or PayPal.' },
  { q: 'How long does shipping take?', a: 'Standard shipping takes 3–7 business days within the US. Express shipping (1–2 business days) is available at checkout for an additional fee. International orders may take 7–21 days depending on the destination.' },
  { q: 'Can I track my order?', a: 'Yes! Once your order is shipped, you\'ll find tracking information in your Orders page. You can also contact our support team with your order ID for a status update.' },
  { q: 'What is your return policy?', a: 'We accept returns within 30 days of delivery for unused items in their original packaging. To start a return, submit a support ticket with your order ID. Refunds are processed in crypto within 3–5 business days.' },
  { q: 'Are there age restrictions?', a: 'Yes. You must be 21 years or older to purchase from our store. By placing an order, you confirm that you meet the minimum age requirement in your jurisdiction.' },
  { q: 'How do I contact customer support?', a: 'Visit our Support page to submit a ticket. Our team responds within 24–48 hours on business days. For urgent matters, check our System Status page first to see if there are any known issues.' },
  { q: 'How do I earn rewards points?', a: 'Every purchase earns you points based on the order total. You can redeem points for discounts on future purchases or exclusive products. Visit the Rewards page to see your balance and available rewards.' },
];

function ChevronIcon({ open }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(null);
  const toggle = i => setOpen(o => o === i ? null : i);

  useEffect(() => {
    api.get('/content/faq')
      .then(data => {
        const items = data.faqs || data || [];
        setFaqs(items.length > 0 ? items : STATIC_FAQS);
      })
      .catch(() => setFaqs(STATIC_FAQS));
  }, []);

  const items = faqs.length > 0 ? faqs : STATIC_FAQS;

  return (
    <main className="main-content">
      <div className="page-container page-container--narrow">
        <h1 className="page-title">Frequently Asked Questions</h1>
        <p className="page-subtitle">Find answers to the most common questions about our shop.</p>

        <div className="faq-list">
          {items.map((faq, i) => (
            <div key={faq.id || i} className={`faq-item${open === i ? ' open' : ''}`}>
              <button className="faq-question" onClick={() => toggle(i)}>
                <span>{faq.q || faq.question}</span>
                <ChevronIcon open={open === i} />
              </button>
              {open === i && (
                <div className="faq-answer">{faq.a || faq.answer}</div>
              )}
            </div>
          ))}
        </div>

        <div className="faq-footer-note">
          <p>Can't find your answer? <a href="/support" className="link-primary">Contact Support</a></p>
        </div>
      </div>
    </main>
  );
}
