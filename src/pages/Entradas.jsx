import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Boxes, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { registerStockEntry } from '../services/storeService';
import { formatDateTime, toNumber } from '../utils/formatters';

const emptyEntry = { produtoId: '', quantidade: '', observacao: '' };

export default function Entradas() {
  const { user, canEdit } = useAuth();
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyEntry);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(collection(db, 'produtos'), (snapshot) => {
    setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((product) => product.ativo !== false).sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR')));
  }), []);

  useEffect(() => onSnapshot(query(collection(db, 'entradas'), orderBy('data', 'desc')), (snapshot) => {
    setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setLoading(false);
  }, (error) => {
    setFeedback({ type: 'error', text: error.message || 'Não foi possível carregar as entradas.' });
    setLoading(false);
  }), []);

  const selectedProduct = useMemo(() => products.find((product) => product.id === form.produtoId), [products, form.produtoId]);
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitEntry = async (event) => {
    event.preventDefault();
    if (!form.produtoId || toNumber(form.quantidade) <= 0) {
      setFeedback({ type: 'error', text: 'Selecione um produto e informe uma quantidade válida.' });
      return;
    }

    setSaving(true);
    try {
      const result = await registerStockEntry({ productId: form.produtoId, quantity: form.quantidade, note: form.observacao, user });
      setForm(emptyEntry);
      setFeedback({ type: 'success', text: `${result.productName}: estoque atualizado para ${result.newStock} unidade(s).` });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível registrar a entrada.' });
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit()) return <div className="access-restricted">Você não possui permissão para registrar entradas.</div>;

  return (
    <div>
      <div className="page-header"><h2>Entradas</h2><p>Registre compras e a produção dos produtos finais em uma única tela.</p></div>
      {feedback && <div className={`notice notice-${feedback.type}`}>{feedback.text}</div>}

      <div className="entry-layout">
        <form className="panel entry-form" onSubmit={submitEntry}>
          <div className="panel-heading"><div><h3>Nova entrada</h3><p>A quantidade é adicionada ao estoque imediatamente.</p></div><Boxes size={22} /></div>
          <div className="form-group"><label htmlFor="entry-product">Produto</label><select id="entry-product" value={form.produtoId} onChange={(event) => updateForm('produtoId', event.target.value)} required><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.nome} · {toNumber(product.estoque)} un.</option>)}</select></div>
          <div className="form-group"><label htmlFor="entry-quantity">Quantidade</label><input id="entry-quantity" type="number" min="1" step="1" value={form.quantidade} onChange={(event) => updateForm('quantidade', event.target.value)} placeholder="0" required /></div>
          <div className="form-group"><label htmlFor="entry-note">Observação <em>(opcional)</em></label><textarea id="entry-note" value={form.observacao} onChange={(event) => updateForm('observacao', event.target.value)} placeholder="Ex.: Compra no fornecedor" /></div>
          {selectedProduct && <div className="entry-preview"><span>Estoque após o lançamento</span><strong>{toNumber(selectedProduct.estoque) + toNumber(form.quantidade)} un.</strong></div>}
          <button className="btn btn-primary btn-full" type="submit" disabled={saving}><Plus size={17} /> {saving ? 'Registrando...' : 'Registrar entrada'}</button>
        </form>

        <section className="panel"><div className="panel-heading"><div><h3>Últimas entradas</h3><p>Movimentações mais recentes do estoque.</p></div><ShoppingBag size={22} /></div><div className="compact-list">
          {entries.slice(0, 8).map((entry) => <div className="compact-list-item" key={entry.id}><div><strong>{entry.produtoNome}</strong><span>{entry.tipo} · {formatDateTime(entry.data)}</span></div><b>+{toNumber(entry.quantidade)} un.</b></div>)}
          {loading && <div className="empty-state">Carregando entradas...</div>}
          {!loading && !entries.length && <div className="empty-state">Nenhuma entrada registrada.</div>}
        </div></section>
      </div>
    </div>
  );
}
