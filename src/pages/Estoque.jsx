import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowRight, Search, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { formatCurrency, toNumber } from '../utils/formatters';

export default function Estoque() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(collection(db, 'produtos'), (snapshot) => {
    setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setLoading(false);
  }, (snapshotError) => {
    setError(snapshotError.message || 'Não foi possível carregar o estoque.');
    setLoading(false);
  }), []);

  const inventory = useMemo(() => [...products]
    .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'))
    .filter((product) => `${product.nome} ${product.categoria}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    .filter((product) => status === 'todos' || (status === 'baixo' ? toNumber(product.estoque) <= toNumber(product.estoqueMinimo) : toNumber(product.estoque) > toNumber(product.estoqueMinimo))), [products, search, status]);

  const lowStock = products.filter((product) => toNumber(product.estoque) <= toNumber(product.estoqueMinimo));
  const stockValue = products.reduce((total, product) => total + (toNumber(product.estoque) * toNumber(product.precoCusto ?? product.precoVenda)), 0);

  return (
    <div>
      <div className="page-header page-header-actions">
        <div><h2>Estoque</h2><p>Acompanhe a disponibilidade e os alertas dos produtos.</p></div>
        <Link className="btn btn-primary" to="/entradas">Registrar entrada <ArrowRight size={17} /></Link>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <div className="summary-grid">
        <div className="stat-card"><span className="stat-card-label">Unidades em estoque</span><div className="stat-card-value">{products.reduce((total, product) => total + toNumber(product.estoque), 0)}</div></div>
        <div className="stat-card"><span className="stat-card-label">Produtos com estoque baixo</span><div className="stat-card-value">{lowStock.length}</div></div>
        <div className="stat-card"><span className="stat-card-label">Valor estimado em estoque</span><div className="stat-card-value stat-card-money">{formatCurrency(stockValue)}</div></div>
      </div>

      {lowStock.length > 0 && <div className="stock-alert"><TriangleAlert size={19} /><div><strong>{lowStock.length} produto(s) precisam de atenção.</strong><span>{lowStock.slice(0, 4).map((product) => product.nome).join(' · ')}{lowStock.length > 4 ? '…' : ''}</span></div><Link to="/entradas">Registrar entrada</Link></div>}

      <div className="table-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar situação"><option value="todos">Todas as situações</option><option value="baixo">Estoque baixo</option><option value="normal">Em estoque</option></select><span>{inventory.length} item(ns)</span></div>
      <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Disponível</th><th>Mínimo</th><th>Preço de venda</th><th>Situação</th></tr></thead><tbody>
        {inventory.map((product) => {
          const stock = toNumber(product.estoque);
          const low = stock <= toNumber(product.estoqueMinimo);
          return <tr key={product.id}><td><strong>{product.nome}</strong></td><td>{product.categoria}</td><td>{stock} un.</td><td>{toNumber(product.estoqueMinimo)} un.</td><td>{formatCurrency(product.precoVenda ?? product.preco)}</td><td><span className={`badge ${low ? 'badge-red' : 'badge-green'}`}>{low ? 'Estoque baixo' : 'Em estoque'}</span></td></tr>;
        })}
        {loading && <tr><td className="empty-state" colSpan="6">Carregando estoque...</td></tr>}
        {!loading && !inventory.length && <tr><td className="empty-state" colSpan="6">Nenhum produto corresponde aos filtros.</td></tr>}
      </tbody></table></div>
    </div>
  );
}
