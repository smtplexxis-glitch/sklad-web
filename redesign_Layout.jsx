import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleLabels = { admin: 'Администратор', storekeeper: 'Кладовщик', manager: 'Менеджер' };

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

const NAV = [
  { group: 'Обзор', items: [
    { to: '/', end: true, label: 'Дашборд', icon: 'ti-home' },
  ]},
  { group: 'Продажи', items: [
    { to: '/deals', label: 'Сделки', icon: 'ti-shopping-cart' },
    { to: '/clients', label: 'Клиенты', icon: 'ti-users' },
    { to: '/payments', label: 'Платежи', icon: 'ti-cash' },
  ]},
  { group: 'Склад', items: [
    { to: '/receipts', label: 'Поступления', icon: 'ti-truck-delivery' },
    { to: '/products', label: 'Товары', icon: 'ti-package' },
    { to: '/archive', label: 'Архив', icon: 'ti-archive' },
    { to: '/donors', label: 'Доноры', icon: 'ti-car' },
    { to: '/storage', label: 'Склад и адреса', icon: 'ti-map-pin' },
    { to: '/print-settings', label: 'Настройки печати', icon: 'ti-printer' },
  ]},
  { group: 'Выгрузка', items: [
    { to: '/categories', label: 'Категории и маппинг', icon: 'ti-category' },
  ]},
];

const ADMIN_NAV = { group: 'Компания', items: [
  { to: '/settings', label: 'Настройки', icon: 'ti-settings' },
  { to: '/users', label: 'Пользователи', icon: 'ti-user-cog' },
]};

export default function Layout() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('sklad_theme') || 'new');
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const scrollRef = useRef(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sklad_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'new') return;
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const y = el.scrollTop;
      if (y > lastScrollY.current + 4 && y > 60) setCollapsed(true);
      else if (y < lastScrollY.current - 4) setCollapsed(false);
      lastScrollY.current = y;
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [theme]);

  const isNew = theme === 'new';
  const showExpanded = !collapsed || hovering;
  const navList = user?.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV;

  if (!isNew) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark"></div>
            <div>
              <div className="logo-text">Склад ЭксАвто</div>
              <div className="logo-sub">Учётная система</div>
            </div>
          </div>
          {navList.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-group-title">{g.group}</div>
              <nav>
                {g.items.map(it => (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({isActive})=>isActive?'active':''}>{it.label}</NavLink>
                ))}
              </nav>
            </div>
          ))}
          <a href="/uploads/connector/sklad-mobile.apk" download style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 12px', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, color: '#fff', textDecoration: 'none', fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>⬇</span>
            <span>Приложение для склада (Android)</span>
          </a>
          <div style={{ padding: '16px 18px', marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--dark-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials(user?.full_name)}
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#fff' }}>{user?.full_name}</div>
                <div style={{ fontSize: 12, color: '#8b93a3' }}>{roleLabels[user?.role] || user?.role}</div>
              </div>
            </div>
            <button className="secondary" onClick={logout} style={{ width: '100%', marginBottom: 8 }}>Выйти</button>
            <button className="secondary" onClick={() => setTheme('new')} style={{ width: '100%' }}>Новый дизайн</button>
          </div>
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="bp-layout">
      <aside
        className={'bp-sidebar' + (showExpanded ? ' bp-expanded' : ' bp-collapsed')}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="bp-logo">
          <div className="bp-logo-mark"><i className="ti ti-feather" aria-hidden="true"></i></div>
          {showExpanded && <span className="bp-logo-text">Большая Птица</span>}
        </div>

        <div className="bp-nav-scroll">
          {navList.map(g => (
            <div className="bp-nav-group" key={g.group}>
              {showExpanded && <div className="bp-nav-title">{g.group}</div>}
              <nav>
                {g.items.map(it => (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({isActive})=> 'bp-nav-link' + (isActive ? ' bp-active' : '')} title={!showExpanded ? it.label : undefined}>
                    <i className={'ti ' + it.icon} aria-hidden="true"></i>
                    {showExpanded && <span>{it.label}</span>}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="bp-sidebar-footer">
          <div className="bp-user">
            <div className="bp-avatar">{initials(user?.full_name)}</div>
            {showExpanded && (
              <div>
                <div className="bp-user-name">{user?.full_name}</div>
                <div className="bp-user-role">{roleLabels[user?.role] || user?.role}</div>
              </div>
            )}
          </div>
          {showExpanded && (
            <>
              <button className="bp-btn-3d bp-btn-outline" onClick={logout}><i className="ti ti-logout" aria-hidden="true"></i> Выйти</button>
              <button className="bp-btn-3d bp-btn-outline" onClick={() => setTheme('old')}><i className="ti ti-arrow-back-up" aria-hidden="true"></i> Старый дизайн</button>
            </>
          )}
        </div>
      </aside>
      <main className="bp-content" ref={scrollRef}>
        <Outlet />
      </main>
    </div>
  );
}
