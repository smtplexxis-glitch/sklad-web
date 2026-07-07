import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ReturnsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/products?status=return&limit=100')
      .then(r => setItems(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function resolve(id, status) {
    if (status === 'written_off') {
      const reason = window.prompt('Причина списания:');
      if (!reason || !reason.trim()) return;
      try {
        await api.patch(`/products/${id}/status`, { status, writeoff_reason: reason.trim() });
        load();
      } catch (e) {
        alert(e?.response?.data?.error || 'Ошибка');
      }
    } else {
      if (!window.confirm('Вернуть товар в запчасти?')) return;
      try {
        await api.patch(`/products/${id}/status`, { status });
        load();
      } catch (e) {
        alert(e?.response?.data?.error || 'Ошибка');
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Возвраты</h1>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Товары, требующие проверки после возврата по браку</div>
        </div>
      </div>

      {loading && <div style={{ padding: 24, color: 'var(--text-dim)' }}>Загрузка...</div>}
      {!loading && items.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)' }}>Нет товаров на проверке.</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {items.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16 }}>
            {p.thumbnail && (
              <img src={p.thumbnail} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link to={`/products/${p.id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--text)' }}>{p.name}</Link>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>
                Артикул: {p.sku} {p.donor_brand ? `· ${p.donor_brand} ${p.donor_model || ''}` : ''}
              </div>
              {p.oem_number && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>OEM: {p.oem_number}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-dark" onClick={() => resolve(p.id, 'in_stock')}>Вернуть в запчасти</button>
              <button className="btn-outline" style={{ color: '#e74c3c' }} onClick={() => resolve(p.id, 'written_off')}>Списать</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
