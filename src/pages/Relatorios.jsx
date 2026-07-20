import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { BarChart3, Download, Package, TrendingUp } from 'lucide-react';
import { db } from '../firebase';
import { formatCurrency, formatDateTime, toNumber } from '../utils/formatters';

const timestampDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);

export default function Relatorios() {
  const [sales, setSales] = useState([]);
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'vendas'), (snapshot) => {
    setSales(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
    );
  });

  return unsubscribe;
}, []);

useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'entradas'), (snapshot) => {
    setEntries(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
    );
  });

  return unsubscribe;
}, []);

useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'produtos'), (snapshot) => {
    setProducts(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
    );
  });

  return unsubscribe;
}, []);
  const report = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - Number(period) + 1);
    const selectedSales = sales.filter((sale) => { const date = timestampDate(sale.data); return date && date >= cutoff; });
    const selectedEntries = entries.filter((entry) => { const date = timestampDate(entry.data); return date && date >= cutoff; });
    const itemTotals = new Map();
    const paymentTotals = {};
    let profit = 0;
    selectedSales.forEach((sale) => {
      paymentTotals[sale.pagamento || 'Não informado'] = (paymentTotals[sale.pagamento || 'Não informado'] || 0) + toNumber(sale.total);
      sale.itens?.forEach((item) => {
        const current = itemTotals.get(item.nome) || { nome: item.nome, quantidade: 0, faturamento: 0 };
        current.quantidade += toNumber(item.quantidade);
        current.faturamento += toNumber(item.subtotal);
        itemTotals.set(item.nome, current);
        if (item.precoCusto !== null && item.precoCusto !== undefined) profit += (toNumber(item.precoUnitario) - toNumber(item.precoCusto)) * toNumber(item.quantidade);
      });
    });
    const bestSellers = [...itemTotals.values()].sort((first, second) => second.quantidade - first.quantidade);
    const lowStock = products.filter((product) => toNumber(product.estoque) <= toNumber(product.estoqueMinimo));
    return {
      cutoff,
      sales: selectedSales,
      entries: selectedEntries,
      revenue: selectedSales.reduce((sum, sale) => sum + toNumber(sale.total), 0),
      quantity: selectedSales.reduce((total, sale) => {
  const saleQuantity =
    sale.itens?.reduce(
      (sum, item) => sum + toNumber(item.quantidade),
      0
    ) ?? 0;

  return total + saleQuantity;
}, 0),
      profit,
      bestSellers,
      paymentTotals,
      lowStock,
    };
  }, [entries, period, products, sales]);

  const exportCsv = () => {
    const rows = [['Data', 'Pagamento', 'Itens', 'Total'], ...report.sales.map((sale) => [formatDateTime(sale.data), sale.pagamento, sale.itens?.map((item) => `${item.nome} (${item.quantidade})`).join(' | '), toNumber(sale.total).toFixed(2)])];
    const content = rows.map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    link.download = `relatorio-vendas-${period}-dias.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="page-header page-header-actions"><div><h2>Relatórios</h2><p>Analise vendas, produtos e movimentações do período.</p></div><div className="header-controls"><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período do relatório"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select><button className="btn btn-outline" onClick={exportCsv}><Download size={17} /> Exportar vendas</button></div></div>
      <div className="summary-grid"><div className="stat-card"><span className="stat-card-label">Total vendido</span><div className="stat-card-value stat-card-money">{formatCurrency(report.revenue)}</div></div><div className="stat-card"><span className="stat-card-label">Itens vendidos</span><div className="stat-card-value">{report.quantity}</div></div><div className="stat-card"><span className="stat-card-label">Lucro estimado</span><div className="stat-card-value stat-card-money">{formatCurrency(report.profit)}</div><small>Considera itens com preço de custo.</small></div></div>
      <div className="report-grid"><section className="panel"><div className="panel-heading"><div><h3>Produtos mais vendidos</h3><p>Ranking no período selecionado.</p></div><TrendingUp size={22} /></div><div className="table-wrap table-wrap-embedded"><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Faturamento</th></tr></thead><tbody>{report.bestSellers.slice(0, 8).map((item) => <tr key={item.nome}><td><strong>{item.nome}</strong></td><td>{item.quantidade} un.</td><td>{formatCurrency(item.faturamento)}</td></tr>)}{!report.bestSellers.length && <tr><td className="empty-state" colSpan="3">Ainda não há vendas no período.</td></tr>}</tbody></table></div></section><section className="panel"><div className="panel-heading"><div><h3>Formas de pagamento</h3><p>Valores recebidos por método.</p></div><BarChart3 size={22} /></div><div className="payment-list">{Object.entries(report.paymentTotals).map(([method, total]) => <div key={method}><span>{method}</span><strong>{formatCurrency(total)}</strong></div>)}{!Object.keys(report.paymentTotals).length && <div className="empty-state">Sem dados para o período.</div>}</div></section></div>
      <div className="report-grid"><section className="panel"><div className="panel-heading"><div><h3>Entradas realizadas</h3><p>{report.entries.length} lançamento(s) no período.</p></div><Package size={22} /></div><div className="compact-list">{report.entries.slice(0, 8).map((entry) => <div className="compact-list-item" key={entry.id}><div><strong>{entry.produtoNome}</strong><span>{entry.tipo} · {formatDateTime(entry.data)}</span></div><b>+{toNumber(entry.quantidade)} un.</b></div>)}{!report.entries.length && <div className="empty-state">Nenhuma entrada no período.</div>}</div></section><section className="panel"><div className="panel-heading"><div><h3>Estoque baixo</h3><p>Produtos que precisam de reposição.</p></div></div><div className="compact-list">{report.lowStock.slice(0, 8).map((product) => <div className="compact-list-item" key={product.id}><div><strong>{product.nome}</strong><span>Mínimo: {toNumber(product.estoqueMinimo)} un.</span></div><b className="danger-text">{toNumber(product.estoque)} un.</b></div>)}{!report.lowStock.length && <div className="empty-state">Nenhum alerta de estoque.</div>}</div></section></div>
    </div>
  );
}
