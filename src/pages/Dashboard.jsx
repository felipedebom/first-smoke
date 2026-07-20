import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { BarChart3, CreditCard, PackageSearch, ShoppingBag, TriangleAlert, Wallet } from 'lucide-react';
import { db } from '../firebase';
import {
  formatCurrency,
  formatDateTime,
  toNumber,
} from '../../formatters';

const sameDay = (first, second) => first.getDate() === second.getDate() && first.getMonth() === second.getMonth() && first.getFullYear() === second.getFullYear();
const timestampDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [receivables, setReceivables] = useState([]);
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'produtos'),
    (snapshot) => {
      setProducts(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    }
  );

  return unsubscribe;
}, []);

useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'vendas'),
    (snapshot) => {
      setSales(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    }
  );

  return unsubscribe;
}, []);

useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'fiados'),
    (snapshot) => {
      setReceivables(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    }
  );

  return unsubscribe;
}, []);

  const overview = useMemo(() => {
    const now = new Date();
    const lowStock = products.filter((product) => toNumber(product.estoque) <= toNumber(product.estoqueMinimo));
    const salesToday = sales.filter((sale) => {
      const date = timestampDate(sale.data);
      return date && sameDay(date, now);
    });
    const salesMonth = sales.filter((sale) => {
      const date = timestampDate(sale.data);
      return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const topProductMap = new Map();
    sales.forEach((sale) => sale.itens?.forEach((item) => topProductMap.set(item.nome, (topProductMap.get(item.nome) || 0) + toNumber(item.quantidade))));
    const topProducts = [...topProductMap.entries()].sort((first, second) => second[1] - first[1]).slice(0, 5);
    const paymentTotals = sales.reduce((totals, sale) => ({ ...totals, [sale.pagamento || 'Não informado']: (totals[sale.pagamento || 'Não informado'] || 0) + toNumber(sale.total) }), {});
    const week = [...Array(7)].map((_, index) => {
      const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(now.getDate() - (6 - index));
      return { label: day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), value: sales.filter((sale) => { const date = timestampDate(sale.data); return date && sameDay(date, day); }).reduce((sum, sale) => sum + toNumber(sale.total), 0) };
    });

    return {
      lowStock,
      todayTotal: salesToday.reduce((sum, sale) => sum + toNumber(sale.total), 0),
      monthTotal: salesMonth.reduce((sum, sale) => sum + toNumber(sale.total), 0),
      inventoryValue: products.reduce((sum, product) => sum + toNumber(product.estoque) * toNumber(product.precoCusto ?? product.precoVenda), 0),
      receivables: receivables.filter((item) => item.status !== 'Pago').reduce((sum, item) => sum + toNumber(item.valor), 0),
      topProducts,
      paymentTotals,
      week,
      recentSales: [...sales].sort((first, second) => (timestampDate(second.data)?.getTime() || 0) - (timestampDate(first.data)?.getTime() || 0)).slice(0, 6),
    };
  }, [products, receivables, sales]);

  const maxWeekValue = Math.max(...overview.week.map((day) => day.value), 1);

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2><p>Visão geral da Firts Smoke.</p></div>
      <div className="metric-grid">
        <div className="metric-card"><div className="metric-icon"><Wallet size={20} /></div><span>Vendas de hoje</span><strong>{formatCurrency(overview.todayTotal)}</strong></div>
        <div className="metric-card"><div className="metric-icon"><BarChart3 size={20} /></div><span>Vendas no mês</span><strong>{formatCurrency(overview.monthTotal)}</strong></div>
        <div className="metric-card"><div className="metric-icon"><PackageSearch size={20} /></div><span>Produtos cadastrados</span><strong>{products.length}</strong></div>
        <div className="metric-card"><div className="metric-icon"><TriangleAlert size={20} /></div><span>Estoque baixo</span><strong>{overview.lowStock.length}</strong></div>
        <div className="metric-card"><div className="metric-icon"><ShoppingBag size={20} /></div><span>Valor em estoque</span><strong>{formatCurrency(overview.inventoryValue)}</strong></div>
        <div className="metric-card"><div className="metric-icon"><CreditCard size={20} /></div><span>Fiado em aberto</span><strong>{formatCurrency(overview.receivables)}</strong></div>
      </div>

      <div className="dashboard-main-grid">
        <section className="panel chart-panel"><div className="panel-heading"><div><h3>Vendas dos últimos 7 dias</h3><p>Total vendido por dia.</p></div><BarChart3 size={22} /></div><div className="week-chart">{overview.week.map((day) => <div className="chart-bar-group" key={day.label}><span className="chart-value">{day.value ? formatCurrency(day.value) : ''}</span><div className="chart-track"><div className="chart-bar" style={{ height: `${(day.value / maxWeekValue) * 100}%` }} /></div><small>{day.label}</small></div>)}</div></section>
        <section className="panel"><div className="panel-heading"><div><h3>Mais vendidos</h3><p>Quantidade acumulada nas vendas.</p></div><ShoppingBag size={22} /></div><div className="rank-list">{overview.topProducts.map(([name, quantity], index) => <div className="rank-item" key={name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><b>{quantity} un.</b></div>)}{!overview.topProducts.length && <div className="empty-state">As vendas concluídas aparecerão aqui.</div>}</div></section>
      </div>

      <div className="dashboard-main-grid">
        <section className="panel"><div className="panel-heading"><div><h3>Últimas vendas</h3><p>Movimentações concluídas recentemente.</p></div></div><div className="compact-list">{overview.recentSales.map((sale) => <div className="compact-list-item" key={sale.id}><div><strong>{sale.itens?.map((item) => item.nome).join(', ') || 'Venda sem itens'}</strong><span>{formatDateTime(sale.data)} · {sale.pagamento}</span></div><b>{formatCurrency(sale.total)}</b></div>)}{!overview.recentSales.length && <div className="empty-state">Nenhuma venda registrada.</div>}</div></section>
        <section className="panel"><div className="panel-heading"><div><h3>Total por pagamento</h3><p>Distribuição das vendas concluídas.</p></div></div><div className="payment-list">{Object.entries(overview.paymentTotals).map(([method, total]) => <div key={method}><span>{method}</span><strong>{formatCurrency(total)}</strong></div>)}{!Object.keys(overview.paymentTotals).length && <div className="empty-state">Sem pagamentos no período.</div>}</div></section>
      </div>
    </div>
  );
}
