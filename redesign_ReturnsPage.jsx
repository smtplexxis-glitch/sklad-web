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
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Возвраты</h1>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Товары, возвращённые по браку и требующие проверки</div>
        </div>
      </div>

      {loading && <div style={{ padding: 24, color: 'var(--text-dim)' }}>Загрузка...</div>}

      {!loading && items.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>
          Нет товаров, ожидающих проверки после возврата
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="card">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Артикул</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Наименование</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Донор</th>
                <th style={{ textAlign: 'right', padding: 10 }}>Цена</th>
                <th style={{ textAlign: 'right', padding: 10 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: 10, fontFamily: 'monospace' }}>{p.sku}</td>
                  <td style={{ padding: 10 }}>{p.name}</td>
                  <td style={{ padding: 10, color: 'var(--text-dim)' }}>{p.donor_brand} {p.donor_model}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>{Number(p.price || 0).toLocaleString('ru-RU')} ₽</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    <Link to={`/products/${p.id}`} className="btn-outline" style={{ fontSize: 12 }}>Открыть</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
