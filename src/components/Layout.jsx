import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, Home, Package, Boxes, ShoppingCart, WalletCards, BarChart3, History, Users, LogOut } from 'lucide-react';

const navItems = [
  { to: '/',          icon: Home,          label: 'Dashboard' },
  { to: '/produtos',  icon: Package,       label: 'Produtos' },
  { to: '/estoque',   icon: Boxes,         label: 'Estoque' },
  { to: '/entradas',  icon: Boxes,         label: 'Entradas' },
  { to: '/vendas',    icon: ShoppingCart,  label: 'Vendas' },
  { to: '/fiado',     icon: WalletCards,   label: 'Fiado' },
  { to: '/relatorios',icon: BarChart3,     label: 'Relatórios' },
  { to: '/historico', icon: History,       label: 'Histórico' },
];

export default function Layout() {
  const { profile, signOut, canManage } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const close = () => setOpen(false);

  return (
    <div className="layout">
      <button className="menu-toggle-mobile" onClick={() => setOpen(!open)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo" aria-label="First Smoke">
          First<span> Smoke</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to==='/'} onClick={close} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
          {canManage() && (
            <NavLink to="/usuarios" onClick={close} className={({ isActive }) => isActive ? 'active' : ''}>
              <Users size={18} /> Usuários
            </NavLink>
          )}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{profile?.nome?.[0] || '?'}</div>
          <div className="sidebar-user-info">
            <strong>{profile?.nome || 'Usuário'}</strong>
            <span>{profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'admin' ? 'Admin' : 'Funcionário'}</span>
          </div>
          <button onClick={handleLogout} title="Sair"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
