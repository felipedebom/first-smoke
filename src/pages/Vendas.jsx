import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { completeSale } from '../services/storeService';
import { formatCurrency, toNumber } from '../utils/formatters';

const paymentMethods = ['PIX', 'Dinheiro', 'Cartão', 'Fiado'];

export default function Vendas() {
  const { user, canOperate } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'produtos'), (snapshot) => {
    setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((product) => product.ativo !== false));
  }), []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return [...products]
      .filter((product) => !term || `${product.nome} ${product.categoria}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'));
  }, [products, search]);

  const cartItems = useMemo(() => cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.produtoId);
    if (!product) return null;
    const price = toNumber(product.precoVenda ?? product.preco);
    return { ...item, nome: product.nome, categoria: product.categoria, estoque: toNumber(product.estoque), precoUnitario: price, subtotal: price * item.quantidade };
  }).filter(Boolean), [cart, products]);

  const total = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const change = Math.max(toNumber(receivedAmount) - total, 0);

  const addProduct = (product) => {
    if (toNumber(product.estoque) <= 0) return;
    setFeedback(null);
    setCart((current) => {
      const existing = current.find((item) => item.produtoId === product.id);
      if (existing) return current.map((item) => item.produtoId === product.id ? { ...item, quantidade: Math.min(item.quantidade + 1, toNumber(product.estoque)) } : item);
      return [...current, { produtoId: product.id, quantidade: 1 }];
    });
  };

  const updateQuantity = (productId, nextQuantity) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const safeQuantity = Math.min(Math.max(nextQuantity, 0), toNumber(product.estoque));
    setCart((current) => safeQuantity === 0 ? current.filter((item) => item.produtoId !== productId) : current.map((item) => item.produtoId === productId ? { ...item, quantidade: safeQuantity } : item));
  };

  const finishSale = async () => {
    if (!cartItems.length) {
      setFeedback({ type: 'error', text: 'Adicione pelo menos um produto ao carrinho.' });
      return;
    }
    if (paymentMethod === 'Dinheiro' && toNumber(receivedAmount) < total) {
      setFeedback({ type: 'error', text: 'O valor recebido é menor que o total da venda.' });
      return;
    }
    if (paymentMethod === 'Fiado' && !customerName.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome do cliente para registrar o fiado.' });
      return;
    }

    setFinishing(true);
    try {
      const result = await completeSale({ items: cartItems, paymentMethod, receivedAmount, customerName, user });
      setCart([]);
      setReceivedAmount('');
      setCustomerName('');
      setFeedback({ type: 'success', text: `Venda concluída: ${formatCurrency(result.total)}${paymentMethod === 'Dinheiro' ? ` · troco de ${formatCurrency(result.change)}` : ''}.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível concluir a venda.' });
    } finally {
      setFinishing(false);
    }
  };

  if (!canOperate()) return <div className="access-restricted">Seu usuário não possui permissão operacional.</div>;

  return (
    <div>
      <div className="page-header"><h2>Vendas</h2><p>Caixa rápido para registrar vendas e baixar o estoque automaticamente.</p></div>
      {feedback && <div className={`notice notice-${feedback.type}`}>{feedback.text}</div>}

      <div className="pos-layout">
        <section className="panel pos-catalog">
          <div className="panel-heading"><div><h3>Produtos disponíveis</h3><p>Selecione para adicionar ao carrinho.</p></div><span className="catalog-count">{visibleProducts.length}</span></div>
          <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" autoFocus /></label>
          <div className="product-grid">
            {visibleProducts.map((product) => {
              const outOfStock = toNumber(product.estoque) <= 0;
              return <button className="product-card" key={product.id} onClick={() => addProduct(product)} disabled={outOfStock}><span>{product.categoria}</span><strong>{product.nome}</strong><div><b>{formatCurrency(product.precoVenda ?? product.preco)}</b><small>{outOfStock ? 'Sem estoque' : `${toNumber(product.estoque)} un. disponíveis`}</small></div></button>;
            })}
            {!visibleProducts.length && <div className="empty-state">Nenhum produto disponível.</div>}
          </div>
        </section>

        <aside className="panel checkout-panel">
          <div className="panel-heading"><div><h3>Venda atual</h3><p>{cartItems.length ? `${cartItems.length} item(ns) no carrinho` : 'Adicione produtos para iniciar'}</p></div><ShoppingCart size={22} /></div>
          <div className="cart-list">
            {cartItems.map((item) => <div className="cart-item" key={item.produtoId}><div><strong>{item.nome}</strong><span>{formatCurrency(item.precoUnitario)} cada</span></div><div className="cart-item-actions"><div className="quantity-control"><button onClick={() => updateQuantity(item.produtoId, item.quantidade - 1)} aria-label={`Diminuir ${item.nome}`}><Minus size={14} /></button><b>{item.quantidade}</b><button onClick={() => updateQuantity(item.produtoId, item.quantidade + 1)} aria-label={`Aumentar ${item.nome}`}><Plus size={14} /></button></div><strong>{formatCurrency(item.subtotal)}</strong><button className="icon-button icon-button-danger" title="Remover item" onClick={() => updateQuantity(item.produtoId, 0)}><Trash2 size={15} /></button></div></div>)}
            {!cartItems.length && <div className="empty-cart"><ShoppingCart size={28} /><span>Seu carrinho está vazio.</span></div>}
          </div>

          <div className="checkout-summary"><div><span>Subtotal</span><b>{formatCurrency(total)}</b></div><div className="checkout-total"><span>Total</span><strong>{formatCurrency(total)}</strong></div></div>
          <div className="form-group"><label htmlFor="payment-method">Forma de pagamento</label><select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div>
          {paymentMethod === 'Dinheiro' && <div className="cash-fields"><div className="form-group"><label htmlFor="received-amount">Valor recebido</label><input id="received-amount" type="number" min="0" step="0.01" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} placeholder="0,00" /></div><div className="change-card"><span>Troco</span><strong>{formatCurrency(change)}</strong></div></div>}
          {paymentMethod === 'Fiado' && <div className="form-group"><label htmlFor="customer-name">Cliente</label><input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nome completo do cliente" /></div>}
          <button className="btn btn-primary btn-full" onClick={finishSale} disabled={finishing || !cartItems.length}>{finishing ? 'Concluindo...' : `Concluir venda · ${formatCurrency(total)}`}</button>
        </aside>
      </div>
    </div>
  );
}
