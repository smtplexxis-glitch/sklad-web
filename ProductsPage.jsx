const PROD_STATUS = { in_stock: 'В наличии', reserved: 'Резерв', sold: 'Продан', return: 'Возврат', written_off: 'Списан' };
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

const statusLabels = { in_stock: 'В наличии', reserved: 'Резерв', sold: 'Продан', return: 'Возврат', written_off: 'Списан' };
const conditionLabels = { used_good: 'Б/у хорошее', used_excellent: 'Б/у отличное', for_restoration: 'На восстановление', new: 'Новое' };
const PAGE_SIZE = 20;

export default function ProductsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '', category_id: '', condition_grade: '', donor_q: '' });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);

  const load = useCallback(async (pageToLoad, append) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.status) params.set('status', filters.status);
      if (filters.category_id) params.set('category_id', filters.category_id);
      if (filters.condition_grade) params.set('condition_grade', filters.condition_grade);
      if (filters.donor_q) params.set('donor_q', filters.donor_q);
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(pageToLoad));
      const res = await api.get(`/products?${params}`);
      const newItems = res.data.items || res.data || [];
      const totalCount = res.data.total || 0;
      setTotal(totalCount);
      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore((append ? (pageToLoad * PAGE_SIZE) : newItems.length) < totalCount);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => { setPage(1); load(1, false); }, [load]);

  useEffect(() => { api.get('/categories').then(r => setCategories(r.data.flat || r.data || [])); }, []);

  useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        setPage(p => {
          const next = p + 1;
          load(next, true);
          return next;
        });
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, load]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Товары</h1>
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Все запчасти на складе. Видно состояние, цену, место и куда выгружено.</div>
        </div>
        <Link to="/receipts"><button className="btn-dark">+ Новое поступление</button></Link>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <input
            placeholder="Поиск: название, OEM, артикул..."
            value={filters.q}
            onChange={e => setFilter('q', e.target.value)}
          />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filters.category_id} onChange={e => setFilter('category_id', e.target.value)}>
            <option value="">Все категории</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.condition_grade} onChange={e => setFilter('condition_grade', e.target.value)}>
            <option value="">Все состояния</option>
            {Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            placeholder="Донор: марка, модель..."
            value={filters.donor_q}
            onChange={e => setFilter('donor_q', e.target.value)}
          />
          {Object.values(filters).some(Boolean) && (
            <button className="btn-outline" onClick={() => setFilters({ q: '', status: '', category_id: '', condition_grade: '', donor_q: '' })}>
              Сбросить
            </button>
          )}
        </div>
      </div>

      {loading ? <div className="empty-state">Загрузка...</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Артикул</th>
                <th>Наименование</th>
                <th>OEM</th>
                <th>Донор</th>
                <th>Состояние</th>
                <th>Цена</th>
                <th>Место</th>
                <th>Выгрузка</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0
                ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>Ничего не найдено</td></tr>
                : items.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      {p.thumbnail
                        ? <img src={p.thumbnail} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                        : <div style={{ width: 32, height: 32, background: 'var(--border)', borderRadius: 4 }} />
                      }
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.sku}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{p.oem_number || '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {p.donor_brand ? `${p.donor_brand} ${p.donor_model}` : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>{conditionLabels[p.condition_grade] || p.condition_grade || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-dim)' }}>{p.storage_code || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <span style={{marginLeft:4, opacity: p.export_avito ? 1 : 0.25, fontSize:10, padding:'1px 5px', background:'#ff8c00', color:'#fff', borderRadius:3}}>A</span>
                        <span style={{marginLeft:2, opacity: p.export_drom ? 1 : 0.25, fontSize:10, padding:'1px 5px', background:'#1976d2', color:'#fff', borderRadius:3}}>Д</span>
                        <span style={{marginLeft:2, opacity: p.export_site ? 1 : 0.25, fontSize:10, padding:'1px 5px', background:'#7b1fa2', color:'#fff', borderRadius:3}}>С</span>
                        {p.export_drom && <span style={{ fontSize: 11, background: '#e74c3c', color: '#fff', borderRadius: 3, padding: '1px 5px' }}>Drom</span>}
                        {p.export_site && <span style={{ fontSize: 11, background: '#2ecc71', color: '#fff', borderRadius: 3, padding: '1px 5px' }}>Сайт</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.status}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
          <div ref={loaderRef} style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
            {loadingMore ? 'Загрузка ещё...' : (hasMore ? '' : (total > 0 ? `Показаны все ${total}` : ''))}
          </div>
          {total > 0 && <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>Показано: {items.length} из {total}</div>}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>Клик по строке открывает карточку товара.</div>
    </div>
  );
}
