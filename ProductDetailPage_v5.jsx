import { uploadFiles } from '../components/UploadProgressWidget';
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import PhotoManager from '../components/PhotoManager';

const conditionLabels = {
  used_good: 'Б/у хорошее',
  used_excellent: 'Б/у отличное',
  for_restoration: 'На восстановление',
  new: 'Новое',
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [recognizingOem, setRecognizingOem] = useState(false);
  const [oemSuggestions, setOemSuggestions] = useState(null);
  const [oemSuggestLoading, setOemSuggestLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [donors, setDonors] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);
  const [crossRef, setCrossRef] = useState({ cross_number: '', brand: '' });
  const [aiLookupBusy, setAiLookupBusy] = useState(false);
  const [applicability, setApplicability] = useState([]);
  const [checkMode, setCheckMode] = useState(false);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [moveReceiptId, setMoveReceiptId] = useState('');
  const [moving, setMoving] = useState(false);
  
  const [printMsg, setPrintMsg] = useState("");
  async function printLabel() {
    try {
      setPrintMsg('...');
      const r = await api.post(`/print/product/${id}`);
      if (r.data && r.data.sent) setPrintMsg('  ');
      else setPrintMsg('  ( )');
      setTimeout(() => setPrintMsg(''), 4000);
    } catch (e) {
      setPrintMsg(' ');
      setTimeout(() => setPrintMsg(''), 4000);
    }
  }

  async function changeStatus(status, reason) {
    try {
      await api.patch(`/products/${id}/status`, { status, writeoff_reason: reason });
      setCheckMode(false); setWriteoffReason('');
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Ошибка');
    }
  }

  async function load() {
    const res = await api.get(`/products/${id}`);
    setProduct(res.data);
    setForm({
      name: res.data.name || '',
      category_id: res.data.category_id || '',
      condition_grade: res.data.condition_grade || 'used_good',
      oem_number: res.data.oem_number || '',
      oem_manufacturer: res.data.oem_manufacturer || '',
      price: res.data.price || '',
      description: res.data.description || '',
      donor_id: res.data.donor_id || '',
      storage_location_id: res.data.storage_location_id || '',
    });
  }

  useEffect(() => { load(); }, [id]);
  async function runAiLookup() {
    if (!product || !product.oem_number) return;
    setAiLookupBusy(true);
    try {
      await api.post(`/products/${id}/ai-lookup`);
      await load();
    } catch (e) {
      alert('AI lookup error: ' + (e?.response?.data?.error || e.message));
    } finally {
      setAiLookupBusy(false);
    }

  async function fetchOemSuggestions() {
    setOemSuggestLoading(true);
    try {
      const r = await api.post(`/products/${id}/oem-suggest`);
      setOemSuggestions(r.data.candidates || []);
    } catch (e) {
      alert(e?.response?.data?.error || 'Ошибка поиска');
    } finally {
      setOemSuggestLoading(false);
    }
  }
  }
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data.flat || r.data || [])); }, []);
  useEffect(() => {
    if (product?.oem_number) {
      api.get(`/oem/applicability?number=${encodeURIComponent(product.oem_number)}`)
        .then(r => setApplicability(r.data || []))
        .catch(() => setApplicability([]));
    }
  }, [product?.oem_number]);
  useEffect(() => { api.get('/donors').then(r => setDonors(r.data.items || r.data || [])); }, []);
  useEffect(() => { api.get('/storage').then(r => setStorageLocations(r.data || [])); }, []);
  useEffect(() => { api.get('/receipts?limit=200').then(r => setReceipts(r.data.items || r.data || [])).catch(() => {}); }, []);
  useEffect(() => { if (product) setMoveReceiptId(product.receipt_id || ''); }, [product]);

  async function moveToReceipt() {
    setMoving(true);
    try {
      await api.patch(`/products/${id}/receipt`, { receipt_id: moveReceiptId || null });
      alert(' ');
      load();
    } catch (e) {
      alert(e.response?.data?.error || ' ');
    } finally {
      setMoving(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    await api.put(`/products/${id}`, form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function addCrossRef(e) {
    e.preventDefault();
    if (!crossRef.cross_number.trim()) return;
    await api.post(`/products/${id}/cross-references`, crossRef);
    setCrossRef({ cross_number: '', brand: '' });
    load();
  }

  function uploadPhoto(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    uploadFiles(id, files, load);
    e.target.value = '';
  }

  async function exportTo(platform, enabled) {
    await api.put(`/products/${id}/export/${platform}`, { enabled });
    load();
  }

  if (!product) return <div className="empty-state">Загрузка...</div>;

  const donorInfo = product.donor_brand
    ? `${product.donor_brand} ${product.donor_model} ${product.donor_year || ''}`
    : null;

  return (
    <div className="page">
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
    <button onClick={() => navigate(-1)} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← Назад</button>
        <h1 style={{ margin: 0 }}>{product.name}</h1>
        <span className={`badge ${product.status}`}>{({'in_stock':'В наличии','reserved':'Резерв','sold':'Продан','return':'Возврат','written_off':'Списан'}[product.status] || product.status)}</span>
          <button onClick={printLabel} style={{ marginLeft: 'auto', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>Печать этикетки</button>
          {printMsg && <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-dim)' }}>{printMsg}</span>}
      </div>

        {product.status === 'return' && (
          <div className="card" style={{ marginBottom: 20, border: '1px solid #f0a500', background: '#fff8e6' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Товар на возврате</div>
            {!checkMode ? (
              <button className="btn" onClick={() => setCheckMode(true)}>Товар проверен</button>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => changeStatus('in_stock')}>Вернуть в наличие</button>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>Или списать (укажите причину):</div>
                  <textarea className="finput" value={writeoffReason} onChange={e => setWriteoffReason(e.target.value)}
                    placeholder="Причина списания..." rows={2} style={{ width: '100%', marginBottom: 8 }} />
                  <button className="btn" disabled={!writeoffReason.trim()}
                    style={{ background: writeoffReason.trim() ? '#c0392b' : '#ccc', color: '#fff', cursor: writeoffReason.trim() ? 'pointer' : 'not-allowed' }}
                    onClick={() => changeStatus('written_off', writeoffReason)}>Списать</button>
                </div>
                <button onClick={() => { setCheckMode(false); setWriteoffReason(''); }}
                  style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13 }}>Отмена</button>
              </div>
            )}
          </div>
        )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Фото */}
        <div>
          
          <PhotoManager
            photos={product.photos || []}
            entityId={id}
            baseUrl="/api/products"
            onReload={load}
            onDelete={(photoId) => api.delete(`/products/${id}/photos/${photoId}`)}
          />
          <label className="btn-outline" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
            + Добавить фото
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} multiple />
          </label>
        </div>
          
          {donorInfo && (
          <div className="card" style={{ padding: '8px 12px', marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>ДОНОР</div>
            <Link to={`/donors/${product.donor_id}`} style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--text)', fontSize: 13 }}>
              {donorInfo}
            </Link>
            {product.donor_vin && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>VIN: {product.donor_vin}</div>}
          </div>
        )
      }

          
        </div>

        {/* Основная форма */}
        <div>
          <form className="card" onSubmit={save}>
            <div className="form-grid">
              <div className="form-row">
                <label>Наименование *</label>
                <input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Артикул</label>
                <input value={product.sku || ''} readOnly style={{ background: 'var(--bg)', color: 'var(--text-dim)' }} />
              </div>
              <div className="form-row">
                <label>Категория</label>
                <select value={form.category_id || ''} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">— без категории —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Состояние</label>
                <select value={form.condition_grade || 'used_good'} onChange={e => setForm({ ...form, condition_grade: e.target.value })}>
                  {Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Донор</label>
                <select value={form.donor_id || ''} onChange={e => setForm({ ...form, donor_id: e.target.value })}>
                  <option value="">— не указан —</option>
                  {donors.map(d => <option key={d.id} value={d.id}>{d.brand} {d.model} {d.year} ({d.code})</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>ОЕМ-номер</label>
                <input value={form.oem_number || ''} onChange={e => setForm({ ...form, oem_number: e.target.value })} />
                  <button
                    type="button"
                    disabled={recognizingOem}
                    onClick={async () => {
                      setRecognizingOem(true);
                      try {
                        const r = await api.post(`/products/${id}/recognize-oem-all`);
                        if (r.data?.ok) {
                          await load();
                        } else {
                          alert(r.data?.error || 'Не удалось распознать номер');
                        }
                      } catch (e) {
                        alert(e?.response?.data?.error || 'Ошибка при распознавании. Убедитесь, что у товара есть фото.');
                      } finally {
                        setRecognizingOem(false);
                      }
                    }}
                    style={{ marginTop: 6, fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--accent, #1a1a2e)', background: '#fff', color: 'var(--accent, #1a1a2e)', cursor: recognizingOem ? 'default' : 'pointer', opacity: recognizingOem ? 0.6 : 1 }}
                  >
                    {recognizingOem ? 'Распознаю…' : 'Определить OEM по фото'}
                  </button>
                  {product?.oem_recognition_status === 'needs_review' && (
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '8px 10px', marginTop: 6, fontSize: 13, color: '#92400e' }}>
                      ⚠ Требует проверки{product?.oem_recognition_confidence != null ? ` (уверенность ${Math.round(product.oem_recognition_confidence * 100)}%)` : ''}.
                      {product?.oem_recognition_comment ? ` ${product.oem_recognition_comment}` : ''}
                    </div>
                  )}
                  {product?.oem_recognition_status === 'auto_confident' && (
                    <div style={{ color: '#16a34a', fontSize: 12, marginTop: 4 }}>
                      ✓ Распознано автоматически{product?.oem_recognition_confidence != null ? ` (${Math.round(product.oem_recognition_confidence * 100)}
{product?.oem_recognition_status === 'none' && (<div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>Номер не обнаружен на фото. Заполните вручную или попробуйте другое фото.</div>)}%)` : ''}
                    </div>
                  )}
              </div>

              {product?.oem_recognition_status === 'none' && (
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn-outline" disabled={oemSuggestLoading} onClick={fetchOemSuggestions} style={{ fontSize: 12 }}>
                    {oemSuggestLoading ? 'Ищу…' : 'Найти номер по донору'}
                  </button>
                  {oemSuggestions !== null && oemSuggestions.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>Не удалось подобрать номер с достаточной уверенностью.</div>
                  )}
                  {oemSuggestions && oemSuggestions.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {oemSuggestions.map((c, i) => (
                        <button key={i} type="button" onClick={() => { setForm(f => ({ ...f, oem_number: c.oem_number })); setOemSuggestions(null); }}
                          style={{ textAlign: 'left', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                          <b>{c.oem_number}</b> <span style={{ color: 'var(--text-dim)' }}>({c.confidence})</span>
                          {c.reasoning && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{c.reasoning}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            <div className="form-row">
              <label> OEM</label>
              <input value={form.oem_manufacturer || ''} onChange={e => setForm({ ...form, oem_manufacturer: e.target.value })} placeholder="напр. Hyundai / KIA" />
            </div>
              <div className="form-row">
                <label>Цена, ₽</label>
                <input type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Место хранения</label>
                <select value={form.storage_location_id || ''} onChange={e => setForm({ ...form, storage_location_id: e.target.value })}>
                  <option value="">— не указано —</option>
                  {storageLocations.map(s => <option key={s.id} value={s.id}>{s.full_code} — {s.full_path}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <label>Описание</label>
              <textarea rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="submit" className="btn-dark">Сохранить</button>
              {saved && <span style={{ color: '#2ecc71', fontSize: 14 }}>✓ Сохранено</span>}
            </div>
          </form>

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>ВЫГРУЗКА НА ПЛОЩАДКИ</div>
            {[['avito','Avito'],['drom','Drom'],['site','Сайт']].map(([key, label]) => {
              const val = product[`export_${key}`]; const active = val === true || val === 1 || val === '1';
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!active} onChange={e => exportTo(key, e.target.checked)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                  {active && <span style={{ fontSize: 11, background: '#2ecc71', color: '#fff', borderRadius: 3, padding: '1px 5px' }}>Активно</span>}
                </label>
              );
            })}
          </div>

                {/* Применимость */}
                <div className='card' style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 8px' }}>Применимость</h3>
                  {(() => { let arr = []; try { arr = JSON.parse(product?.applicability || '[]'); } catch(e) { arr = []; } if (!Array.isArray(arr) || arr.length === 0) return (<div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Применимость не найдена, используйте AI-поиск ниже для поиска</div>); return (
                    <div>
                      {arr.map((a, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'var(--text-dim)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                          {a.make} {a.model}{a.generation ? (' ' + a.generation + ' поколение') : ''} {a.years || ''}{a.body_codes ? (' (' + a.body_codes + ')') : ''}{a.engine ? (' двигатель ' + a.engine) : ''}
                        </div>
                      ))}
                    </div>
                  ); })()}
                </div>


      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>Поступление</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={moveReceiptId} onChange={e => setMoveReceiptId(e.target.value)} style={{ flex: 1, padding: '6px 10px' }}>
            <option value=""> </option>
            {receipts.map(r => <option key={r.id} value={r.id}>{r.num || ('#'+r.id)}</option>)}
          </select>
          <button onClick={moveToReceipt} disabled={moving || String(moveReceiptId)===String(product.receipt_id||'')}>{moving ? '...' : ''}</button>
        </div>
      </div>

          {/* Кросс-номера */}
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Кросс-номера и аналоги</h3>
                <div style={{ marginBottom: 10 }}>
                  <button type='button' onClick={runAiLookup} disabled={aiLookupBusy || !product?.oem_number} style={{ padding: '6px 14px' }}>
                    {aiLookupBusy ? 'Ищу...' : 'Найти через AI'}
                  </button>
                </div>
            {product.cross_references && product.cross_references.length > 0
              ? <table style={{ width: '100%', fontSize: 14 }}>
                  <thead><tr><th>Номер</th><th>Бренд</th></tr></thead>
                  <tbody>{product.cross_references.map((r, i) => <tr key={i}><td>{r.cross_number}</td><td>{r.brand || '—'}</td></tr>)}</tbody>
                </table>
              : <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 }}>Пока не добавлены</div>
            }
            <form onSubmit={addCrossRef} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input placeholder="Номер" value={crossRef.cross_number} onChange={e => setCrossRef({ ...crossRef, cross_number: e.target.value })} style={{ flex: 2 }} />
              <input placeholder="Бренд (опц.)" value={crossRef.brand} onChange={e => setCrossRef({ ...crossRef, brand: e.target.value })} style={{ flex: 1 }} />
              <button type="submit" className="btn-dark" style={{ whiteSpace: 'nowrap' }}>Добавить</button>
            </form>
          </div>
        </div>
      </div>
  );
}
