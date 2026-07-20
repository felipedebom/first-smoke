import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Produtos = lazy(() => import('./pages/Produtos'));
const Estoque = lazy(() => import('./pages/Estoque'));
const Entradas = lazy(() => import('./pages/Entradas'));
const Vendas = lazy(() => import('./pages/Vendas'));
const Fiado = lazy(() => import('./pages/Fiado'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Historico = lazy(() => import('./pages/Historico'));
const Usuarios = lazy(() => import('./pages/Usuarios'));

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Carregando...</div>;

  return (
    <Suspense fallback={<div className="route-loading">Carregando...</div>}>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/entradas" element={<Entradas />} />
          <Route path="/producao" element={<Navigate to="/entradas" replace />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/fiado" element={<Fiado />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} />} />
      </Routes>
    </Suspense>
  );
}
