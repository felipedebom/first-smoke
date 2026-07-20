import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Edit3, PackagePlus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { registerHistory } from '../services/storeService';
import { formatCurrency, toNumber } from '../utils/formatters';

const CATEGORIES = ['Bebidas', 'Pastéis', 'Pizzas', 'Congelados', 'Kits', 'Doces', 'Carvão', 'Tabacaria', 'Outros'];

const emptyForm = {
  nome: '',
  categoria: 'Bebidas',
  precoVenda: '',
  precoCusto: '',
  estoqueInicial: '',
  estoqueMinimo: '',
  ativo: true,
};

export default function Produtos() {
  const { user, canEdit } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
    },
    (error) => {
      setFeedback({
        type: 'error',
        text: error.message || 'Não foi possível carregar os produtos.',
      });
    }
  );

  return unsubscribe;
}, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return [...products]
      .filter((product) => !term || `${product.nome} ${product.categoria}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'));
  }, [products, search]);

  const lowStock = products.filter((product) => toNumber(product.estoque) <= toNumber(product.estoqueMinimo)).length;

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFeedback(null);
    setIsFormOpen(true);
  };

  const openEdit = (product) => {
    setForm({
      nome: product.nome || '',
      categoria: product.categoria || 'Outros',
      precoVenda: String(product.precoVenda ?? product.preco ?? ''),
      precoCusto: product.precoCusto === undefined || product.precoCusto === null ? '' : String(product.precoCusto),
      estoqueInicial: String(toNumber(product.estoque)),
      estoqueMinimo: String(toNumber(product.estoqueMinimo)),
      ativo: product.ativo !== false,
    });
    setEditingId(product.id);
    setFeedback(null);
    setIsFormOpen(true);
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveProduct = async (event) => {
    event.preventDefault();
    if (!form.nome.trim() || toNumber(form.precoVenda) <= 0) {
      setFeedback({ type: 'error', text: 'Informe o nome e um preço de venda maior que zero.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        precoVenda: toNumber(form.precoVenda),
        precoCusto: form.precoCusto === '' ? null : toNumber(form.precoCusto),
        estoqueMinimo: toNumber(form.estoqueMinimo),
        ativo: form.ativo,
        atualizadoEm: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'produtos', editingId), payload);
        await registerHistory(user, `Atualizou o produto ${payload.nome}`, 'produto');
      } else {
        const initialStock = toNumber(form.estoqueInicial);
        await addDoc(collection(db, 'produtos'), {
          ...payload,
          estoque: initialStock,
          criadoEm: serverTimestamp(),
        });
        await registerHistory(user, `Cadastrou o produto ${payload.nome}${initialStock ? ` com ${initialStock} unidade(s) em estoque` : ''}`, 'produto');
      }

      setIsFormOpen(false);
      setFeedback({ type: 'success', text: 'Produto salvo com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível salvar o produto.' });
    } finally {
      setIsSaving(false);
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Excluir o produto “${product.nome}”? Essa ação não pode ser desfeita.`)) return;

    try {
      await deleteDoc(doc(db, 'produtos', product.id));
      await registerHistory(user, `Excluiu o produto ${product.nome}`, 'produto');
      setFeedback({ type: 'success', text: 'Produto excluído.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível excluir o produto.' });
    }
  };

  return (
    <div>
      <div className="page-header page-header-actions">
        <div>
          <h2>Produtos</h2>
          <p>Cadastre preços, categorias e parâmetros de estoque.</p>
        </div>
        {canEdit() && <button className="btn btn-primary" onClick={openNew}><PackagePlus size={17} /> Novo produto</button>}
      </div>

      {feedback && <div className={`notice notice-${feedback.type}`}>{feedback.text}</div>}

      <div className="summary-grid">
        <div className="stat-card"><span className="stat-card-label">Produtos cadastrados</span><div className="stat-card-value">{products.length}</div></div>
        <div className="stat-card"><span className="stat-card-label">Produtos ativos</span><div className="stat-card-value">{products.filter((product) => product.ativo !== false).length}</div></div>
        <div className="stat-card"><span className="stat-card-label">Estoque baixo</span><div className="stat-card-value">{lowStock}</div></div>
      </div>

      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou categoria" />
        </label>
        <span>{filteredProducts.length} produto(s)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Produto</th><th>Categoria</th><th>Venda</th><th>Custo</th><th>Estoque</th><th>Status</th>{canEdit() && <th>Ações</th>}</tr></thead>
          <tbody>
            {filteredProducts.map((product) => {
              const currentStock = toNumber(product.estoque);
              const isLow = currentStock <= toNumber(product.estoqueMinimo);
              return (
                <tr key={product.id}>
                  <td><strong>{product.nome}</strong><small>mínimo: {toNumber(product.estoqueMinimo)} un.</small></td>
                  <td>{product.categoria}</td>
                  <td>{formatCurrency(product.precoVenda ?? product.preco)}</td>
                  <td>{product.precoCusto === null || product.precoCusto === undefined ? '—' : formatCurrency(product.precoCusto)}</td>
                  <td><span className={`badge ${isLow ? 'badge-red' : 'badge-green'}`}>{currentStock} un.</span></td>
                  <td><span className={`badge ${product.ativo !== false ? 'badge-blue' : 'badge-amber'}`}>{product.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                  {canEdit() && <td className="table-actions"><button className="icon-button" title="Editar produto" onClick={() => openEdit(product)}><Edit3 size={16} /></button><button className="icon-button icon-button-danger" title="Excluir produto" onClick={() => removeProduct(product)}><Trash2 size={16} /></button></td>}
                </tr>
              );
            })}
            {!filteredProducts.length && <tr><td colSpan={canEdit() ? 7 : 6} className="empty-state">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="modal-overlay" onMouseDown={() => setIsFormOpen(false)}>
          <form className="modal modal-wide" onSubmit={saveProduct} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><h3>{editingId ? 'Editar produto' : 'Novo produto'}</h3><p>Os campos marcados são usados nas vendas e no estoque.</p></div><button type="button" className="icon-button" onClick={() => setIsFormOpen(false)}><X size={18} /></button></div>
            <div className="form-grid">
              <div className="form-group full"><label htmlFor="product-name">Nome do produto</label><input id="product-name" value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} placeholder="Ex.: Refrigerante lata 350 ml" autoFocus required /></div>
              <div className="form-group"><label htmlFor="product-category">Categoria</label><select id="product-category" value={form.categoria} onChange={(event) => updateForm('categoria', event.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div>
              <div className="form-group"><label htmlFor="product-status">Status</label><select id="product-status" value={String(form.ativo)} onChange={(event) => updateForm('ativo', event.target.value === 'true')}><option value="true">Ativo</option><option value="false">Inativo</option></select></div>
              <div className="form-group"><label htmlFor="product-price">Preço de venda</label><input id="product-price" type="number" min="0" step="0.01" value={form.precoVenda} onChange={(event) => updateForm('precoVenda', event.target.value)} placeholder="0,00" required /></div>
              <div className="form-group"><label htmlFor="product-cost">Preço de custo <em>(opcional)</em></label><input id="product-cost" type="number" min="0" step="0.01" value={form.precoCusto} onChange={(event) => updateForm('precoCusto', event.target.value)} placeholder="0,00" /></div>
              {!editingId && <div className="form-group"><label htmlFor="product-stock">Estoque inicial</label><input id="product-stock" type="number" min="0" step="1" value={form.estoqueInicial} onChange={(event) => updateForm('estoqueInicial', event.target.value)} placeholder="0" /></div>}
              {editingId && <div className="form-group"><label>Estoque atual</label><div className="readonly-field">{form.estoqueInicial} un. <small>Use Entradas para alterar.</small></div></div>}
              <div className="form-group"><label htmlFor="product-minimum">Estoque mínimo</label><input id="product-minimum" type="number" min="0" step="1" value={form.estoqueMinimo} onChange={(event) => updateForm('estoqueMinimo', event.target.value)} placeholder="0" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setIsFormOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar produto'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
