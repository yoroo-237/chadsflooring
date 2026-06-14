import React from 'react';
import { Link } from 'react-router-dom';

export default function ShippingPolicyPage() {
  return (
    <main className="main-content">
      <div className="page-container page-container--narrow">
        <h1 className="page-title">Shipping Policy</h1>
        <p className="page-subtitle">Last updated: January 2025</p>

        <div className="policy-content">
          <section className="policy-section">
            <h2>Processing Time</h2>
            <p>All orders are processed within <strong>1–2 business days</strong> after payment confirmation. Orders placed on weekends or holidays will be processed on the next business day.</p>
            <p>You will receive a tracking number via email once your order has been shipped.</p>
          </section>

          <section className="policy-section">
            <h2>Shipping Methods & Estimates</h2>
            <div className="policy-table">
              <div className="policy-table-row header">
                <span>Method</span><span>Delivery Time</span><span>Cost</span>
              </div>
              <div className="policy-table-row">
                <span>Standard Shipping</span><span>3–7 business days</span><span>$5.99</span>
              </div>
              <div className="policy-table-row">
                <span>Express Shipping</span><span>1–2 business days</span><span>$14.99</span>
              </div>
              <div className="policy-table-row">
                <span>Free Shipping</span><span>5–10 business days</span><span>Free (orders $75+)</span>
              </div>
              <div className="policy-table-row">
                <span>International</span><span>7–21 business days</span><span>Calculated at checkout</span>
              </div>
            </div>
          </section>

          <section className="policy-section">
            <h2>Free Shipping</h2>
            <p>We offer free standard shipping on all domestic orders over <strong>$75</strong>. Free shipping is automatically applied at checkout when your cart total meets the minimum requirement.</p>
          </section>

          <section className="policy-section">
            <h2>International Shipping</h2>
            <p>We ship to most countries worldwide. International shipping rates are calculated at checkout based on destination and package weight. Please be aware that:</p>
            <ul className="policy-list">
              <li>Import duties, taxes, and customs fees are the responsibility of the buyer</li>
              <li>Delivery times may vary due to customs processing</li>
              <li>Some products may be restricted or prohibited in certain countries</li>
              <li>It is your responsibility to know the laws of your jurisdiction</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>Order Tracking</h2>
            <p>Once your order ships, you'll receive a tracking number by email. You can also view your order status in the <Link to="/orders" className="link-primary">Orders</Link> section of your account.</p>
          </section>

          <section className="policy-section">
            <h2>Lost or Damaged Packages</h2>
            <p>If your package is lost in transit or arrives damaged, please <Link to="/support" className="link-primary">contact our support team</Link> within 7 days of the expected delivery date. We will work with the carrier to resolve the issue.</p>
          </section>

          <section className="policy-section">
            <h2>Contact Us</h2>
            <p>If you have any questions about your shipment, please visit our <Link to="/support" className="link-primary">Support page</Link> or check the <Link to="/faq" className="link-primary">FAQ</Link>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
