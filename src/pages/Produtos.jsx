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
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Edit3,
  LoaderCircle,
  Package,
  PackageCheck,
  PackagePlus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { registerHistory } from '../services/storeService';
import { formatCurrency, toNumber } from '../utils/formatters';

const CATEGORIES = [
  'Bebidas',
  'Pastéis',
  'Pizzas',
  'Congelados',
  'Kits',
  'Doces',
  'Carvão',
  'Tabacaria',
  'Outros',
];

const emptyForm = {
  nome: '',
  categoria: 'Bebidas',
  precoVenda: '',
  precoCusto: '',
  estoqueInicial: '',
  estoqueMinimo: '',
  ativo: true,
};

const getStockStatus = (product) => {
  const currentStock = toNumber(product.estoque);
  const minimumStock = toNumber(product.estoqueMinimo);

  if (currentStock <= 0) {
    return {
      label: 'Esgotado',
      className: 'badge-red',
    };
  }

  if (currentStock <= minimumStock) {
    return {
      label: 'Estoque baixo',
      className: 'badge-amber',
    };
  }

  return {
    label: 'Disponível',
    className: 'badge-green',
  };
};

export default function Produtos() {
  const { user, canEdit } = useAuth();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'produtos'),
      (snapshot) => {
        setProducts(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })),
        );

        setIsLoading(false);
      },
      (error) => {
        setFeedback({
          type: 'error',
          text: error.message || 'Não foi possível carregar os produtos.',
        });

        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');

    return [...products]
      .filter((product) => {
        if (!term) return true;

        const searchableContent = `
          ${product.nome || ''}
          ${product.categoria || ''}
        `.toLocaleLowerCase('pt-BR');

        return searchableContent.includes(term);
      })
      .sort((first, second) =>
        (first.nome || '').localeCompare(second.nome || '', 'pt-BR'),
      );
  }, [products, search]);

  const overview = useMemo(() => {
    const activeProducts = products.filter(
      (product) => product.ativo !== false,
    );

    const lowStockProducts = products.filter((product) => {
      const stock = toNumber(product.estoque);
      const minimum = toNumber(product.estoqueMinimo);

      return stock <= minimum;
    });

    const totalStock = products.reduce(
      (total, product) => total + toNumber(product.estoque),
      0,
    );

    const inventoryValue = products.reduce((total, product) => {
      const stock = toNumber(product.estoque);
      const cost = toNumber(product.precoCusto);

      return total + stock * cost;
    }, 0);

    return {
      activeProducts: activeProducts.length,
      lowStockProducts: lowStockProducts.length,
      totalStock,
      inventoryValue,
    };
  }, [products]);

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
      precoCusto:
        product.precoCusto === undefined || product.precoCusto === null
          ? ''
          : String(product.precoCusto),
      estoqueInicial: String(toNumber(product.estoque)),
      estoqueMinimo: String(toNumber(product.estoqueMinimo)),
      ativo: product.ativo !== false,
    });

    setEditingId(product.id);
    setFeedback(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;

    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validateProduct = () => {
    if (!form.nome.trim()) {
      return 'Informe o nome do produto.';
    }

    if (!form.categoria) {
      return 'Selecione uma categoria.';
    }

    if (toNumber(form.precoVenda) <= 0) {
      return 'Informe um preço de venda maior que zero.';
    }

    if (
      form.precoCusto !== ''
      && toNumber(form.precoCusto) < 0
    ) {
      return 'O preço de custo não pode ser negativo.';
    }

    if (
      !editingId
      && toNumber(form.estoqueInicial) < 0
    ) {
      return 'O estoque inicial não pode ser negativo.';
    }

    if (toNumber(form.estoqueMinimo) < 0) {
      return 'O estoque mínimo não pode ser negativo.';
    }

    return null;
  };

  const saveProduct = async (event) => {
    event.preventDefault();

    const validationError = validateProduct();

    if (validationError) {
      setFeedback({
        type: 'error',
        text: validationError,
      });

      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        precoVenda: toNumber(form.precoVenda),
        precoCusto:
          form.precoCusto === ''
            ? null
            : toNumber(form.precoCusto),
        estoqueMinimo: toNumber(form.estoqueMinimo),
        ativo: form.ativo,
        atualizadoEm: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, 'produtos', editingId),
          payload,
        );

        await registerHistory(
          user,
          `Atualizou o produto ${payload.nome}`,
          'produto',
        );
      } else {
        const initialStock = toNumber(form.estoqueInicial);

        await addDoc(collection(db, 'produtos'), {
          ...payload,
          estoque: initialStock,
          criadoEm: serverTimestamp(),
        });

        await registerHistory(
          user,
          `Cadastrou o produto ${payload.nome}${
            initialStock
              ? ` com ${initialStock} unidade(s) em estoque`
              : ''
          }`,
          'produto',
        );
      }

      setIsFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);

      setFeedback({
        type: 'success',
        text: editingId
          ? 'Produto atualizado com sucesso.'
          : 'Produto cadastrado com sucesso.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'Não foi possível salvar o produto.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    setFeedback(null);

    try {
      await deleteDoc(
        doc(db, 'produtos', pendingDelete.id),
      );

      await registerHistory(
        user,
        `Excluiu o produto ${pendingDelete.nome}`,
        'produto',
      );

      setPendingDelete(null);

      setFeedback({
        type: 'success',
        text: 'Produto excluído com sucesso.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.message || 'Não foi possível excluir o produto.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="products-page">
      <header className="page-header page-header-actions products-header">
        <div>
          <span className="products-eyebrow">
            Catálogo e estoque
          </span>

          <h2>Produtos</h2>

          <p>
            Gerencie os produtos, preços e quantidades disponíveis.
          </p>
        </div>

        {canEdit() && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={openNew}
          >
            <PackagePlus size={17} />
            Novo produto
          </button>
        )}
      </header>

      {feedback && (
        <div className={`notice notice-${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <section className="products-summary-grid">
        <article className="stat-card products-stat-card">
          <div className="products-stat-icon">
            <Package size={19} />
          </div>

          <div>
            <span className="stat-card-label">
              Produtos cadastrados
            </span>

            <strong className="stat-card-value">
              {products.length}
            </strong>
          </div>
        </article>

        <article className="stat-card products-stat-card">
          <div className="products-stat-icon">
            <PackageCheck size={19} />
          </div>

          <div>
            <span className="stat-card-label">
              Produtos ativos
            </span>

            <strong className="stat-card-value">
              {overview.activeProducts}
            </strong>
          </div>
        </article>

        <article className="stat-card products-stat-card">
          <div className="products-stat-icon">
            <Boxes size={19} />
          </div>

          <div>
            <span className="stat-card-label">
              Unidades em estoque
            </span>

            <strong className="stat-card-value">
              {overview.totalStock}
            </strong>
          </div>
        </article>

        <article className="stat-card products-stat-card products-stat-highlight">
          <div className="products-stat-icon">
            <CircleDollarSign size={19} />
          </div>

          <div>
            <span className="stat-card-label">
              Valor em estoque
            </span>

            <strong className="stat-card-value stat-card-money">
              {formatCurrency(overview.inventoryValue)}
            </strong>

            <small>
              Calculado pelo preço de custo
            </small>
          </div>
        </article>

        <article className="stat-card products-stat-card">
          <div className="products-stat-icon products-stat-warning">
            <AlertTriangle size={19} />
          </div>

          <div>
            <span className="stat-card-label">
              Estoque baixo
            </span>

            <strong className="stat-card-value">
              {overview.lowStockProducts}
            </strong>
          </div>
        </article>
      </section>

      <section className="products-content">
        <div className="products-toolbar">
          <label className="search-field products-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou categoria"
            />
          </label>

          <span className="products-result-count">
            {filteredProducts.length}{' '}
            {filteredProducts.length === 1
              ? 'produto encontrado'
              : 'produtos encontrados'}
          </span>
        </div>

        <div className="table-wrap products-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Venda</th>
                <th>Custo</th>
                <th>Estoque</th>
                <th>Status</th>

                {canEdit() && <th>Ações</th>}
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => {
                const currentStock = toNumber(product.estoque);
                const stockStatus = getStockStatus(product);

                return (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.nome}</strong>

                      <small>
                        Estoque mínimo:{' '}
                        {toNumber(product.estoqueMinimo)} un.
                      </small>
                    </td>

                    <td>
                      <span className="product-category">
                        {product.categoria}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {formatCurrency(
                          product.precoVenda ?? product.preco,
                        )}
                      </strong>
                    </td>

                    <td>
                      {product.precoCusto === null
                      || product.precoCusto === undefined
                        ? '—'
                        : formatCurrency(product.precoCusto)}
                    </td>

                    <td>
                      <div className="product-stock-cell">
                        <strong>{currentStock} un.</strong>

                        <span
                          className={`badge ${stockStatus.className}`}
                        >
                          {stockStatus.label}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          product.ativo !== false
                            ? 'badge-blue'
                            : 'badge-amber'
                        }`}
                      >
                        {product.ativo !== false
                          ? 'Ativo'
                          : 'Inativo'}
                      </span>
                    </td>

                    {canEdit() && (
                      <td className="table-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title="Editar produto"
                          aria-label={`Editar ${product.nome}`}
                          onClick={() => openEdit(product)}
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          className="icon-button icon-button-danger"
                          type="button"
                          title="Excluir produto"
                          aria-label={`Excluir ${product.nome}`}
                          onClick={() => setPendingDelete(product)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {!isLoading && !filteredProducts.length && (
                <tr>
                  <td
                    colSpan={canEdit() ? 7 : 6}
                    className="empty-state products-empty-state"
                  >
                    <Package size={28} />

                    <strong>Nenhum produto encontrado</strong>

                    <span>
                      Verifique a busca ou cadastre um novo produto.
                    </span>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td
                    colSpan={canEdit() ? 7 : 6}
                    className="empty-state"
                  >
                    Carregando produtos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isFormOpen && (
        <div
          className="modal-overlay"
          onMouseDown={closeForm}
        >
          <form
            className="modal modal-wide product-modal"
            onSubmit={saveProduct}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">
                  {editingId ? 'Edição' : 'Cadastro'}
                </span>

                <h3>
                  {editingId
                    ? 'Editar produto'
                    : 'Novo produto'}
                </h3>

                <p>
                  Preencha as informações utilizadas nas vendas e no estoque.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                aria-label="Fechar formulário"
                onClick={closeForm}
                disabled={isSaving}
              >
                <X size={18} />
              </button>
            </div>

            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>01</span>

                <div>
                  <h4>Informações</h4>
                  <p>Identificação e organização do produto.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group full">
                  <label htmlFor="product-name">
                    Nome do produto
                  </label>

                  <input
                    id="product-name"
                    value={form.nome}
                    onChange={(event) =>
                      updateForm('nome', event.target.value)
                    }
                    placeholder="Ex.: Refrigerante lata 350 ml"
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-category">
                    Categoria
                  </label>

                  <select
                    id="product-category"
                    value={form.categoria}
                    onChange={(event) =>
                      updateForm('categoria', event.target.value)
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option
                        value={category}
                        key={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="product-status">
                    Status
                  </label>

                  <select
                    id="product-status"
                    value={String(form.ativo)}
                    onChange={(event) =>
                      updateForm(
                        'ativo',
                        event.target.value === 'true',
                      )
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>02</span>

                <div>
                  <h4>Valores</h4>
                  <p>Preços utilizados na venda e no controle financeiro.</p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="product-price">
                    Preço de venda
                  </label>

                  <input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precoVenda}
                    onChange={(event) =>
                      updateForm(
                        'precoVenda',
                        event.target.value,
                      )
                    }
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="product-cost">
                    Preço de custo
                    <em> (opcional)</em>
                  </label>

                  <input
                    id="product-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precoCusto}
                    onChange={(event) =>
                      updateForm(
                        'precoCusto',
                        event.target.value,
                      )
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>
            </section>

            <section className="product-form-section">
              <div className="product-form-section-heading">
                <span>03</span>

                <div>
                  <h4>Controle de estoque</h4>
                  <p>Quantidade disponível e limite mínimo de atenção.</p>
                </div>
              </div>

              <div className="form-grid">
                {!editingId ? (
                  <div className="form-group">
                    <label htmlFor="product-stock">
                      Estoque inicial
                    </label>

                    <input
                      id="product-stock"
                      type="number"
                      min="0"
                      step="1"
                      value={form.estoqueInicial}
                      onChange={(event) =>
                        updateForm(
                          'estoqueInicial',
                          event.target.value,
                        )
                      }
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Estoque atual</label>

                    <div className="readonly-field">
                      {form.estoqueInicial} un.

                      <small>
                        Utilize a página Entradas para alterar o estoque.
                      </small>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="product-minimum">
                    Estoque mínimo
                  </label>

                  <input
                    id="product-minimum"
                    type="number"
                    min="0"
                    step="1"
                    value={form.estoqueMinimo}
                    onChange={(event) =>
                      updateForm(
                        'estoqueMinimo',
                        event.target.value,
                      )
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </section>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeForm}
                disabled={isSaving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <LoaderCircle
                      className="button-spinner"
                      size={16}
                    />
                    Salvando...
                  </>
                ) : (
                  <>
                    <PackageCheck size={16} />
                    Salvar produto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div
          className="modal-overlay"
          onMouseDown={() => {
            if (!isDeleting) {
              setPendingDelete(null);
            }
          }}
        >
          <div
            className="modal delete-product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="delete-product-icon">
              <Trash2 size={22} />
            </div>

            <h3 id="delete-product-title">
              Excluir produto?
            </h3>

            <p>
              Você está prestes a excluir{' '}
              <strong>{pendingDelete.nome}</strong>.
            </p>

            <span>
              Essa ação não poderá ser desfeita.
            </span>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <LoaderCircle
                      className="button-spinner"
                      size={16}
                    />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Excluir produto
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}