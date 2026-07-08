import React, { useEffect, useState } from 'react';
import api from '../api/client';

const TABS = ['Компания', 'Пользователи', 'Оплата', 'Доставка', 'Сделки', 'Интеграции', 'История'];
const CARRIERS = ['СДЭК', 'ПЭК', 'Почта России', 'Деловые линии', 'DHL', 'Boxberry', 'Яндекс Доставка', 'Другое'];
const ROLE_LABELS = { admin: 'Администратор', manager: 'Менеджер', storekeeper: 'Кладовщик' };

function notify(setSaved, msg) { setSaved(msg); setTimeout(() => setSaved(''), 2500); }

// ── КОМПАНИЯ ──────────────────────────────────────────────────────────────────
function TabCompany() {
  const [form, setForm] = useState({ name: 'ЭксАвто', inn: '', ogrn: '', phone: '', email: '', address: '', bank: '', bik: '', account: '' });
  const [saved, setSaved] = useState('');
  useEffect(() => { const s = localStorage.getItem('company'); if (s) setForm(JSON.parse(s)); }, []);
  const save = e => { e.preventDefault(); localStorage.setItem('company', JSON.stringify(form)); notify(setSaved, '✓ Сохранено'); };
  const f = (key, label, full) => (
    <div key={key} style={{ gridColumn: full ? '1/-1' : 'auto' }}>
      <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%' }} />
    </div>
  );
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      {saved && <div style={{ background: '#2ecc71', color: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600 }}>{saved}</div>}
      <h3 style={{ margin: '0 0 4px' }}>Информация о компании</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>Используется при выгрузке товаров и в документах</p>
      <form onSubmit={save}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {f('name', 'Название *')} {f('inn', 'ИНН')} {f('ogrn', 'ОГРН')} {f('phone', 'Телефон')} {f('email', 'Email')} {f('address', 'Адрес', true)}
        </div>
        <div style={{ fontWeight: 600, marginBottom: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>Банковские реквизиты</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {f('bank', 'Банк')} {f('bik', 'БИК')} {f('account', 'Расчётный счёт')}
        </div>
        <button type="submit" className="btn-dark">Сохранить</button>
      </form>
    </div>
  );
}

// ── ПОЛЬЗОВАТЕЛИ ──────────────────────────────────────────────────────────────
function TabUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/users');
      setUsers(r.data.items || r.data || []);
    } catch(e) { setErr('Ошибка загрузки: ' + (e.response?.data?.error || e.message)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/users', { full_name: form.name, email: form.email, password: form.password, role: form.role });
      setShowAdd(false); setForm({ name: '', email: '', password: '', role: 'manager' });
      load(); notify(setSaved, '✓ Пользователь создан');
    } catch(e) { setErr(e.response?.data?.error || 'Ошибка'); }
  }

  async function toggleActive(u) {
    try { await api.put(`/users/${u.id}`, { is_active: !u.is_active }); load(); } catch {}
  }

  return (
    <div>
      {saved && <div style={{ background: '#2ecc71', color: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600 }}>{saved}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Сотрудники с доступом в систему</p>
        <button className="btn-dark" onClick={() => { setShowAdd(true); setErr(''); }}>+ Добавить</button>
      </div>

      {loading ? <div style={{ color: 'var(--text-dim)' }}>Загрузка...</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {users.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>Нет пользователей</td></tr>
                : users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name || u.name}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{u.email}</td>
                    <td><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: u.role === 'admin' ? '#e74c3c22' : 'var(--border)', color: u.role === 'admin' ? '#e74c3c' : 'var(--text)' }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td><span style={{ fontSize: 12, color: u.is_active !== false ? '#2ecc71' : '#e74c3c' }}>{u.is_active !== false ? 'Активен' : 'Отключён'}</span></td>
                    <td>
                      <button onClick={() => toggleActive(u)} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: 'var(--border)', border: 'none' }}>
                        {u.is_active !== false ? 'Отключить' : 'Включить'}
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-head"><h2>Новый пользователь</h2><button className="btn-outline" onClick={() => setShowAdd(false)}>✕</button></div>
            <form onSubmit={create}>
              {[['name', 'Имя *', 'text'], ['email', 'Email *', 'email'], ['password', 'Пароль *', 'password']].map(([k, l, t]) => (
                <div className="fg" key={k}><label className="flabel">{l}</label><input required type={t} className="finput" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} /></div>
              ))}
              <div className="fg">
                <label className="flabel">Роль</label>
                <select className="finput" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Администратор</option>
                  <option value="manager">Менеджер</option>
                  <option value="storekeeper">Кладовщик</option>
                </select>
              </div>
              {err && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 8 }}>{err}</div>}
              <div className="modal-foot">
                <button type="button" className="btn-outline" onClick={() => setShowAdd(false)}>Отмена</button>
                <button type="submit" className="btn-dark">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ОПЛАТА ────────────────────────────────────────────────────────────────────
function TabPayment() {
  const DEFAULT = [
    { id: 1, name: 'Наличные', enabled: true, system: true },
    { id: 2, name: 'Перевод на карту', enabled: true, system: true },
    { id: 3, name: 'QR-код / СБП', enabled: false, system: true, note: 'В разработке' },
  ];
  const [methods, setMethods] = useState(DEFAULT);
  const [newName, setNewName] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const s = localStorage.getItem('pay_methods_v2');
    if (s) setMethods(JSON.parse(s));
  }, []);

  function save(updated) {
    setMethods(updated);
    localStorage.setItem('pay_methods_v2', JSON.stringify(updated));
    notify(setSaved, '✓ Сохранено');
  }

  function toggle(id) { save(methods.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m)); }
  function remove(id) { save(methods.filter(m => m.id !== id)); }
  function addMethod() {
    if (!newName.trim()) return;
    save([...methods, { id: Date.now(), name: newName.trim(), enabled: true }]);
    setNewName('');
  }

  return (
    <div style={{ maxWidth: 520 }}>
      {saved && <div style={{ background: '#2ecc71', color: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600 }}>{saved}</div>}
      <div className="card">
        <h3 style={{ margin: '0 0 16px' }}>Способы оплаты</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {methods.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <input type="checkbox" checked={m.enabled} onChange={() => toggle(m.id)} disabled={!!m.note} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                {m.note && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{m.note}</div>}
              </div>
              <span style={{ fontSize: 12, color: m.enabled ? '#2ecc71' : 'var(--text-dim)' }}>{m.enabled ? 'Активно' : 'Выкл.'}</span>
              {!m.system && (
                <button onClick={() => remove(m.id)} style={{ fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input placeholder="Название нового способа оплаты..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMethod()} style={{ flex: 1 }} />
          <button className="btn-dark" onClick={addMethod}>+ Добавить</button>
        </div>
      </div>
    </div>
  );
}

// ── ДОСТАВКА ──────────────────────────────────────────────────────────────────
function TabDelivery() {
  const DEFAULT_CARRIERS = CARRIERS.map((name, i) => ({ id: i + 1, name, enabled: i < 3 }));
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [newCarrier, setNewCarrier] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const s = localStorage.getItem('delivery_carriers');
    if (s) setCarriers(JSON.parse(s));
  }, []);

  function save(updated) {
    setCarriers(updated);
    localStorage.setItem('delivery_carriers', JSON.stringify(updated));
    notify(setSaved, '✓ Сохранено');
  }

  function toggle(id) { save(carriers.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)); }
  function remove(id) { save(carriers.filter(c => c.id !== id)); }
  function add() {
    if (!newCarrier.trim()) return;
    save([...carriers, { id: Date.now(), name: newCarrier.trim(), enabled: true }]);
    setNewCarrier('');
  }

  return (
    <div style={{ maxWidth: 520 }}>
      {saved && <div style={{ background: '#2ecc71', color: '#fff', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontWeight: 600 }}>{saved}</div>}
      <div className="card">
        <h3 style={{ margin: '0 0 4px' }}>Службы доставки</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>Отметьте перевозчиков, с которыми работаете</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {carriers.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${c.enabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: c.enabled ? 'var(--accent)11' : 'transparent' }}>
              <input type="checkbox" checked={c.enabled} onChange={() => toggle(c.id)} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: c.enabled ? 'var(--accent)' : 'var(--text-dim)' }}>{c.enabled ? 'Используется' : 'Не используется'}</span>
              {!CARRIERS.includes(c.name) && (
                <button onClick={() => remove(c.id)} style={{ fontSize: 12, color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input placeholder="Добавить перевозчика..." value={newCarrier} onChange={e => setNewCarrier(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 1 }} />
          <button className="btn-dark" onClick={add}>+ Добавить</button>
        </div>
      </div>
    </div>
  );
}

// ── ГЛАВНЫЙ КОМПОНЕНТ ─────────────────────────────────────────────────────────

function TabDeals() {
  const [settings, setSettings] = React.useState({
    deal_statuses: ['new','in_work','issued','completed','cancelled'],
    default_reserve_days: 3,
    allow_partial_payment: true,
    auto_close_paid: false,
  });

  const statusLabels = {
    new: 'Новая', in_work: 'В работе', issued: 'Выдана',
    completed: 'Завершена', cancelled: 'Отменена'
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px' }}>Статусы сделок</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {settings.deal_statuses.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: 'var(--bg)', borderRadius: 6, fontSize: 14 }}>
              <span className={`badge badge-${s}`} style={{ minWidth: 80 }}>{statusLabels[s]}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>({s})</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 12 }}>
          Статусы используются автоматически. Новая сделка начинается со статуса "Новая",
          после выдачи товара переходит в "Выдана".
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px' }}>Параметры сделок</h3>
        <div className="form-grid">
          <div className="fg">
            <label className="flabel">Дней резерва по умолчанию</label>
            <input className="finput" type="number" min="1" max="90"
              value={settings.default_reserve_days}
              onChange={e => setSettings(s => ({...s, default_reserve_days: +e.target.value}))} />
          </div>
          <div className="fg">
            <label className="flabel">Разрешить частичную оплату</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
              <input type="checkbox" checked={settings.allow_partial_payment}
                onChange={e => setSettings(s => ({...s, allow_partial_payment: e.target.checked}))} />
              <span style={{ fontSize: 14 }}>Да, разрешить</span>
            </div>
          </div>
        </div>
        <button className="btn-dark" style={{ marginTop: 12 }}
          onClick={() => alert('Настройки сохранены')}>Сохранить</button>
      </div>
    </div>
  );
}

function TabIntegrations() {
  const [avito, setAvito] = React.useState({ enabled: false, markup: 20 });
  const [drom, setDrom] = React.useState({ enabled: false, markup: 20 });

  React.useEffect(() => {
    const a = localStorage.getItem('avito_settings');
    const d = localStorage.getItem('drom_settings');
    if (a) setAvito(JSON.parse(a));
    if (d) setDrom(JSON.parse(d));
  }, []);

  const setMarkup = (type, val) => { const n = Math.max(0, parseFloat(val)||0); if (type === 'avito') { const v = { ...avito, markup: n }; setAvito(v); localStorage.setItem('avito_settings', JSON.stringify(v)); } else { const v = { ...drom, markup: n }; setDrom(v); localStorage.setItem('drom_settings', JSON.stringify(v)); } };
  const toggle = (type, val) => {
    if (type === 'avito') {
      const v = { ...avito, enabled: val };
      setAvito(v); localStorage.setItem('avito_settings', JSON.stringify(v));
    } else {
      const v = { ...drom, enabled: val };
      setDrom(v); localStorage.setItem('drom_settings', JSON.stringify(v));
    }
  };

  const FeedBlock = ({ name, path, enabled, onToggle, markup, onMarkupChange }) => (
    <div className='card' style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type='checkbox' checked={enabled} onChange={e => onToggle(e.target.checked)} />
          {enabled ? ' ' : ' '}
        </label>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 13 }}>Наценка, %:</span><input type='number' value={markup} onChange={e => onMarkupChange(e.target.value)} style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }} /></div>
            Ссылка на XML:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input readOnly value={`https://sklad.exclauto.ru${path}?markup=${markup}`}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />
        <button className='btn-outline' style={{ whiteSpace: 'nowrap' }}
          onClick={() => navigator.clipboard.writeText(`https://sklad.exclauto.ru${path}?markup=${markup}`)}>
          
        </button>
      </div>
      {enabled && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#27ae60' }}>
                {name}    .
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 0 }}>
      <FeedBlock name='Авито' path='/feed/avito.xml' enabled={avito.enabled} onToggle={v => toggle('avito', v)} markup={avito.markup ?? 20} onMarkupChange={v => setMarkup('avito', v)} />
      <FeedBlock name='Дром' path='/feed/drom.xml' enabled={drom.enabled} onToggle={v => toggle('drom', v)} markup={drom.markup ?? 20} onMarkupChange={v => setMarkup('drom', v)} />
      <ExtraDescBlock labelAvito="Текст в конец описания на Авито" labelDrom="Текст в конец описания на Дром" btnLabel="Сохранить" okLabel="Сохранено" />
    </div>
  );
}
function ExtraDescBlock({ labelAvito, labelDrom, btnLabel, okLabel }) {
  const [vals, setVals] = React.useState({ avito: '', drom: '' });
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { api.get('/refs/feed-extra-desc').then(r => setVals({ avito: r.data.avito || '', drom: r.data.drom || '' })); }, []);
  async function save() {
    await api.post('/refs/feed-extra-desc', vals);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="fg">
        <label className="flabel">{labelAvito}</label>
        <textarea className="finput" rows="3" value={vals.avito} onChange={e => setVals(v => ({ ...v, avito: e.target.value }))} />
      </div>
      <div className="fg">
        <label className="flabel">{labelDrom}</label>
        <textarea className="finput" rows="3" value={vals.drom} onChange={e => setVals(v => ({ ...v, drom: e.target.value }))} />
      </div>
      <button className="btn-dark" onClick={save}>{saved ? okLabel : btnLabel}</button>
    </div>
  );
}
function TabHistory() {
  const webItems = [
    { date: '2026-06-30', text: 'Исправлен поиск товаров по артикулу в мобильном сканере (сканер не находил товары вне первых 100/200 позиций).' },
    { date: '2026-06-30', text: 'Добавлен серверный поиск товара по точному SKU (/products/by-sku/:code), увеличены лимиты выборки товаров.' },
    { date: '2026-06-30', text: 'Реализовано удаление поступления (с каскадным удалением товаров и фото) и перенос товара между поступлениями.' },
    { date: '2026-06-30', text: 'Добавлены кнопки «Завершить», «Распровести» и «Удалить поступление» на странице поступления.' },
    { date: '2026-06-30', text: 'Добавлена кнопка удаления отдельного товара из карточки поступления.' },
    { date: '2026-06-30', text: 'Подключена применимость TecDoc к карточке товара через таблицу tree_node_products.' },
    { date: '2026-06-30', text: 'Исправлен формат описания в фидах Avito/Drom: Артикул/Номер/Производитель/Состояние, блок Комментарий, донора снизу.' },
    { date: '2026-06-30', text: 'Исправлена ошибка 500 в фиде Drom (опечатка в имени переменной наценки).' },
    { date: '2026-06-30', text: 'Добавлен справочник марка → производитель OEM-запчастей (86 марок), выбор производителя у донора.' },
    { date: '2026-06-30', text: 'Производитель OEM у товара теперь наследуется от донора и обновляется каскадно.' },
    { date: '2026-07-01', text: 'Исправлена ошибка прав доступа к файлам фронтенда после сборки (403 Forbidden).' },
    { date: '2026-07-01', text: 'Добавлена вкладка «История изменений и доработок» в настройках.' },
{ date: '2026-07-01', text: 'Правки обновления по сборке фронтенда - исправлено автоматически.' },
{ date: '2026-07-02', text: 'Опубликован APK со всеми правками 2 июля: удаление товара, автовыход, пагинация списка, место в списке, удаление фото.' },
{ date: '2026-07-04', text: 'Интеграция доставки в сделки: новый статус На доставке, выбор службы (СДЭК, ПЭК, Озон, Почта России), трек-номер, автоматическое отслеживание статуса через moyaposylka.ru, авто-закрытие сделки после вручения покупателю.', major: true },
{ date: '2026-07-03', text: 'AI-поиск кросс-номеров и применимости по OEM-номеру на карточке товара, интеграция через прокси-сервер.', major: true },
{ date: '2026-07-03', text: 'Применимость выводится структурированно: марка, модель, поколение, годы, кузовные коды, двигатель — по одной строке на поколение.' },
{ date: '2026-07-03', text: 'TecDoc полностью удалён с сайта: из навигации, роутов и карточки товара.' },
{ date: '2026-07-04', text: 'Улучшено распознавание OEM-номера с фото: модель теперь получает название детали и отличает настоящий номер от маркировки пластика.' },
{ date: '2026-07-04', text: 'Промпт поиска кросс-номеров ужесточён: модель не угадывает номер, если не уверена -лучше пустой список, чем неверная деталь.' },
{ date: '2026-07-04', text: 'Исправлен баг: удалённый товар в поступлении оставался видимым (не исключался статус cancelled из выборки).' },
{ date: '2026-07-07', text: 'Исправлен критический баг: сделки на доставке закрывались автоматически раньше времени из-за ошибки в проверке статуса доставки.', major: true },
{ date: '2026-07-07', text: 'Добавлена полная история статусов доставки в сделке — видно все события от отправки до вручения, а не только последний статус.' },
{ date: '2026-07-07', text: 'Исправлено добавление товара в сделку: клик по товару в списке выбора не срабатывал из-за ошибки в коде.', major: true },
{ date: '2026-07-07', text: 'Список выбора товара в сделке теперь загружается сразу при открытии, без необходимости что-то вводить в поиск.' },
{ date: '2026-07-07', text: 'Список товаров теперь загружается по 20 штук с автоматической подгрузкой при прокрутке вниз — раньше показывались только последние 100 позиций.', major: true },
{ date: '2026-07-07', text: 'В поступлении добавлена возможность создать нового поставщика прямо на месте, без перехода в другой раздел.' },
{ date: '2026-07-07', text: 'В форму добавления позиции поступления добавлены описание, место хранения и флажок печати наклейки.' },
{ date: '2026-07-07', text: 'При добавлении товара в сделку теперь автоматически проставляется резерв на 3 дня.' },
{ date: '2026-07-07', text: 'Убран неактуальный пункт «Профили площадок» из общего меню.' },
{ date: '2026-07-07', text: 'Наценка для выгрузок на Авито и Дром теперь настраивается в настройках, а не зафиксирована на 20%.' },
{ date: '2026-07-07', text: 'Для выгрузки на Дром добавлено состояние товара (новое / б.у.), которое раньше не передавалось.' },
{ date: '2026-07-07', text: 'Переписаны тексты статусов распознавания OEM-номера по фото — раньше при неудаче показывалось пустое сообщение без текста.' },
{ date: '2026-07-07', text: 'Исправлен зум фото в полноэкранном режиме карточки товара.' },
{ date: '2026-07-07', text: 'Улучшено сопоставление применимости по донору: поколения автомобилей вида «Focus 2» и «Focus II» теперь считаются одинаковыми при проверке совместимости.', major: true },
{ date: '2026-07-07', text: 'Исправлена критическая ошибка, из-за которой страница поставщиков открывалась полностью пустой.', major: true },
{ date: '2026-07-07', text: 'Кнопка «Назад» в карточке товара теперь возвращает на предыдущую страницу (например, в поступление), а не всегда в общий список запчастей.' },
    { date: '2026-07-08', text: 'Полностью переписана логика возврата товара из сделки: причина «не подошло» возвращает деталь сразу в наличие, «брак»/«другое» отправляет на отдельную проверку. Сумма к оплате в сделке автоматически уменьшается на сумму возврата, сделка закрывается сама, когда возвращены все позиции.', major: true },
    { date: '2026-07-08', text: 'Добавлен новый раздел «Возвраты» — список деталей на проверке после брака, с кнопками «Вернуть в запчасти» и «Списать», плюс комментарий о состоянии детали.', major: true },
    { date: '2026-07-08', text: 'Добавлен комментарий к возврату товара — можно описать, что именно с деталью, видно на странице «Возвраты».' },
    { date: '2026-07-08', text: 'Исправлена применимость товаров с неверным донором в данных (например, Cadillac STS ошибочно показывался как Chevrolet Lacetti) — донор автомобиля теперь всегда гарантированно входит в список применимости.', major: true },
    { date: '2026-07-08', text: 'Добавлен автоматический поиск OEM-номера по донору и названию детали через ИИ — используется, когда номер не удалось распознать по фото.', major: true },
    { date: '2026-07-08', text: 'В карточке товара донор и выгрузка на площадки объединены в один блок, донор показывает больше деталей (код, VIN, кузов, двигатель, топливо, пробег).' },
    { date: '2026-07-08', text: 'Найдена и устранена причина полного простоя сайта на 2,5 часа — синтаксическая ошибка в проверке оплаты перед доставкой не позволяла серверу запуститься.', major: true },
    { date: '2026-07-08', text: 'Добавлена защита от повторного сбоя сервера: проверка кода перед каждым запуском и автоматический мониторинг раз в минуту с автоперезапуском.', major: true },
    { date: '2026-07-08', text: 'Срок действия входа увеличен с 12 часов до 30 дней — больше не будет неожиданного разлогина посреди работы.', major: true },
    { date: '2026-07-08', text: 'Исправлен баг: сделка закрывалась как завершённая после доставки, даже если оплата не была внесена полностью.' },
    { date: '2026-07-08', text: 'Проведена сверка товаров склада с сайтом exclauto.ru — найдены и сняты с публикации 2 позиции, которые уже проданы или списаны на складе, но оставались доступны для заказа на сайте.' },
    { date: '2026-07-08', text: 'Исправлены перепутанные названия и OEM-номера у партии товаров Cadillac STS (усилитель звука, панель приборов, блок управления подвеской и др.) — данные при приёмке оказались смещены между позициями, восстановлены по официальным данным.', major: true },
  ];
  const mobileItems = [
    { date: '2026-06-30', text: 'Исправлен сканер: товары вне первых 100 позиций не находились — теперь точный поиск по SKU.' },
    { date: '2026-07-08', text: 'Исправлена проблема, из-за которой приложение переставало загружать данные после долгого простоя (нужно было переустанавливать) — теперь при возврате в приложение реально проверяется действительность сессии на сервере.', major: true },
    { date: '2026-07-08', text: 'Добавлена кнопка выхода из аккаунта на главном экране.' },
    { date: '2026-07-08', text: 'В карточке сделки теперь отображается статус доставки, служба, трек-номер и полная история событий отслеживания.' },
    { date: '2026-07-08', text: 'Обновлён цвет оформления приложения — единый фиолетовый акцент с веб-версией.' },
    { date: '2026-07-08', text: 'В карточке сделки добавлена кнопка «Отправить на доставку» с выбором службы (СДЭК, ПЭК, Ozon, Почта России) и вводом трек-номера — раньше в приложении этого шага не было вообще.', major: true },
    { date: '2026-07-08', text: 'Оформление возврата товара переработано: теперь спрашивает причину (не подошло/брак/другое) и даёт написать комментарий о состоянии детали — раньше просто молча возвращало товар без вопросов.', major: true },
    { date: '2026-07-08', text: 'Кнопка «Внести оплату» теперь скрывается после отмены сделки.' },
    { date: '2026-07-08', text: 'Исправлен баг: применимость товара по донорам не показывалась в карточке — поле терялось при загрузке данных с сервера.', major: true },
    { date: '2026-07-08', text: 'Увеличено время ожидания при распознавании OEM-номера по фото — раньше при долгой обработке падала ошибка «сеть», хотя распознавание просто не успевало.' },
    { date: '2026-07-08', text: 'Исправлен баг, позволявший добавить один и тот же товар в сделку дважды подряд.' },
    { date: '2026-07-08', text: 'Добавлены объёмные 3D-тени на плитках главного экрана и главной кнопке действия — единый стиль с веб-версией.' },
    { date: '2026-07-08', text: 'Срок действия входа увеличен до 30 дней — не будет неожиданного разлогина.' },
    { date: '2026-06-30', text: 'Добавлен звук «пик» при успешном сканировании штрихкода.' },
    { date: '2026-06-30', text: 'Исправлено зависание сканера после первого скана — пересоздание камеры через события навигации.' },
    { date: '2026-07-01', text: 'Исправлен баг сохранения карточки донора (несовпадение статусов с базой).' },
    { date: '2026-07-01', text: 'Кнопка «Назад» заменена с текстового символа на иконку.' },
    { date: '2026-07-01', text: 'Добавлено автоматическое распознавание OEM-номера по фото при загрузке нового товара.', major: true },
    { date: '2026-07-01', text: 'Добавлена кнопка «Определить OEM по фото» для повторного запуска распознавания.' },
    { date: '2026-07-01', text: 'Добавлено отображение статуса распознавания OEM с пояснением от AI.' },
    { date: '2026-07-01', text: 'Реализован перенос и удаление товара прямо в поступлении (иконки в строке).' },
{ date: '2026-07-02', text: 'Исправлен баг удаления товара в поступлении 4 работает для всех.' },
{ date: '2026-07-02', text: 'Автоматический выход на экран входа при истечении сессии, без чистки кэша.' },
{ date: '2026-07-02', text: 'Список товаров на главной загружается по 200 вместо 1000.' },
{ date: '2026-07-02', text: 'Всплывает место хранения в списке товаров и в карточке товара.' },
{ date: '2026-07-02', text: 'Добавлено удаление отдельного фото товара прямо в карточке товара.' },
{ date: '2026-07-02', text: 'Опубликован новый APK со всеми правками 0 июля.' },
{ date: '2026-07-03', text: 'Исправлена причина, по которой приложение зависало после перезагрузки: токен теперь сбрасывается при истечении сессии, автоматический переход на экран входа.' },
{ date: '2026-07-03', text: 'Добавлена кнопка «Найти через AI» на карточке товара — кросс-номера и применимость по OEM-номеру, с тем же структурированным форматом, что и на сайте.', major: true },
{ date: '2026-07-04', text: 'Добавлен автоповтор загрузки фото при сетевой ошибке (до 3 попыток) — устраняет пропадающие миниатюры.' },
  ];
  const Col = ({ title, items }) => (
    <div className="card" style={{ flex: 1, minWidth: 320 }}>
      <h3 style={{ margin: '0 0 12px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.slice().reverse().map((it, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>{it.date}</div>
            <div style={{ fontSize: 13, marginTop: 2, fontWeight: it.major ? 700 : 400 }}>{it.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <Col title="Веб-версия" items={webItems} />
      <Col title="Мобильное приложение" items={mobileItems} />
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('Компания');
  return (
    <div className="page">
      <div className="page-header"><h1>Настройки</h1></div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 22px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t ? 'var(--accent)' : 'var(--text-dim)', marginBottom: -2 }}>{t}</button>
        ))}
      </div>
      {tab === 'Компания'     && <TabCompany />}
      {tab === 'Пользователи' && <TabUsers />}
      {tab === 'Оплата'       && <TabPayment />}
      {tab === 'Доставка'     && <TabDelivery />}
      {tab === 'Сделки'       && <TabDeals />}
      {tab === 'Интеграции'   && <TabIntegrations />}
        {tab === 'История'       && <TabHistory />}
    </div>
  );
}
