import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminFetch } from './utils/api';

const EMPTY = { name: '', description: '', price: '', stock: 1, sku: '', isActive: true, isFeatured: false, categoryId: '', brandId: '', imageUrl: '' };

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [form, setForm]           = useState(EMPTY);
  const [options, setOptions]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands]       = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading]     = useState(isEdit);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState(null);

  useEffect(() => {
    Promise.all([
      adminFetch('/admin/categories?limit=200'),
      adminFetch('/admin/brands?limit=200'),
      isEdit ? adminFetch(`/admin/products/${id}`) : Promise.resolve(null),
    ]).then(([cats, brnds, prod]) => {
      setCategories(cats.categories || cats || []);
      setBrands(brnds.brands || brnds || []);
      if (prod) {
        const p = prod.product || prod;
        setForm({
          name: p.name || '', description: p.description || '', price: p.price || '',
          stock: p.stock ?? '', sku: p.sku || '', isActive: p.isActive ?? true,
          isFeatured: p.isFeatured ?? false, categoryId: p.categoryId || '',
          brandId: p.brandId || '', imageUrl: p.imageUrl || '',
        });
        setOptions(p.options || []);
        setImagePreview(p.imageUrl || '');
      }
      setLoading(false);
    }).catch(e => { setErr(e.message); setLoading(false); });
  }, [id, isEdit]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleImage = e => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addOption = () => setOptions(o => [...o, { id: null, label: '', priceModifier: 0, stock: 0 }]);
  const setOpt = (i, k, v) => setOptions(o => o.map((op, idx) => idx === i ? { ...op, [k]: v } : op));
  const removeOpt = i => setOptions(o => o.filter((_, idx) => idx !== i));

  const submit = async e => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url    = isEdit ? `/admin/products/${id}` : '/admin/products';
      const method = isEdit ? 'PUT' : 'POST';
      const body   = { ...form, options };
      if (imageFile) {
        const fd = new FormData();
        Object.entries(body).forEach(([k, v]) => {
          if (k === 'options') fd.append(k, JSON.stringify(v));
          else fd.append(k, v);
        });
        fd.append('image', imageFile);
        await adminFetch(url, { method, body: fd, isFormData: true });
      } else {
        await adminFetch(url, { method, body });
      }
      navigate('/mario-dashboard/products');
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="admin-page-title">{isEdit ? 'Edit Product' : 'New Product'}</h1>
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 16 }}>{err}</div>}

      <form onSubmit={submit}>
        <div className="admin-grid-2" style={{ marginBottom: 20 }}>
          <div className="admin-card">
            <div className="admin-card-title">Product Info</div>
            <div className="admin-form-group">
              <label className="admin-label">Name *</label>
              <input className="admin-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Description</label>
              <textarea className="admin-textarea" value={form.description} onChange={e => set('description', e.target.value)} rows={4} />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-label">Price *</label>
                <input className="admin-input" type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Stock *</label>
                <input className="admin-input" type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} required />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-label">SKU</label>
                <input className="admin-input" value={form.sku} onChange={e => set('sku', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Category</label>
                <select className="admin-select" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                  <option value="">None</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-label">Brand</label>
                <select className="admin-select" value={form.brandId} onChange={e => set('brandId', e.target.value)}>
                  <option value="">None</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group" style={{ justifyContent: 'flex-end' }}>
                <label className="admin-form-check">
                  <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} /> Active
                </label>
                <label className="admin-form-check" style={{ marginTop: 8 }}>
                  <input type="checkbox" checked={form.isFeatured} onChange={e => set('isFeatured', e.target.checked)} /> Featured
                </label>
              </div>
            </div>
          </div>

          <div>
            {/* Image */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-card-title">Product Image</div>
              {imagePreview && <img src={imagePreview} alt="preview" className="admin-img-preview" style={{ width: 120, height: 120, marginBottom: 12 }} />}
              <input type="file" accept="image/*" onChange={handleImage} style={{ fontSize: 13 }} />
              {!imageFile && (
                <div className="admin-form-group" style={{ marginTop: 12 }}>
                  <label className="admin-label">Or image URL</label>
                  <input className="admin-input" value={form.imageUrl} onChange={e => { set('imageUrl', e.target.value); setImagePreview(e.target.value); }} placeholder="https://…" />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="admin-card-title" style={{ marginBottom: 0 }}>Options</div>
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={addOption}>+ Add</button>
              </div>
              {options.length === 0
                ? <div style={{ color: '#6c757d', fontSize: 13 }}>No options — product sold as-is.</div>
                : options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                    <div className="admin-form-group" style={{ flex: 2, marginBottom: 0 }}>
                      <label className="admin-label">Label</label>
                      <input className="admin-input" value={opt.label} onChange={e => setOpt(i, 'label', e.target.value)} placeholder="e.g. 3.5g" />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="admin-label">+Price</label>
                      <input className="admin-input" type="number" step="0.01" value={opt.priceModifier} onChange={e => setOpt(i, 'priceModifier', e.target.value)} />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label className="admin-label">Stock</label>
                      <input className="admin-input" type="number" min="0" value={opt.stock} onChange={e => setOpt(i, 'stock', e.target.value)} />
                    </div>
                    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeOpt(i)} style={{ marginBottom: 2 }}>✕</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
