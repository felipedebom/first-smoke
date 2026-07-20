import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  CheckCircle2,
  Search,
  WalletCards,
  X,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { settleReceivable } from '../services/storeService';
import {
  formatCurrency,
  formatDateTime,
  toNumber,
} from '../utils/formatters';

const getOpenAmount = (receivable) =>
  toNumber(receivable.saldoPendente ?? receivable.valor);

export default function Fiado() {
  const { user, canEdit, canOperate } = useAuth();

  const [receivables, setReceivables] = useState([]);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(false);
      },
      (error) => {
        setFeedback({
          type: 'error',
          text:
            error.message ||
            'Não foi possível carregar os valores em aberto.',
        });
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');

    return [...receivables]
      .filter((item) => {
        const customerName = item.clienteNome
          ?.toLocaleLowerCase('pt-BR');

        return !term || customerName?.includes(term);
      })
      .sort((first, second) => {
        const firstDate =
          first.data?.toDate?.()?.getTime?.() || 0;

        const secondDate =
          second.data?.toDate?.()?.getTime?.() || 0;

        return secondDate - firstDate;
      });
  }, [receivables, search]);

  const openReceivables = receivables.filter(
    (item) =>
      item.status !== 'Pago' &&
      getOpenAmount(item) > 0
  );

  const openTotal = openReceivables.reduce(
    (sum, item) => sum + getOpenAmount(item),
    0
  );

  const openPaymentModal = (receivable) => {
    setSelectedReceivable(receivable);
    setPaymentAmount('');
    setFeedback(null);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    if (isSettling) return;

    setSelectedReceivable(null);
    setPaymentAmount('');
    setIsPaymentModalOpen(false);
  };

  const handlePayment = async (amount) => {
    if (!selectedReceivable) return;

    const openAmount = getOpenAmount(selectedReceivable);
    const receivedAmount = toNumber(amount);

    if (receivedAmount <= 0) {
      setFeedback({
        type: 'error',
        text: 'Informe um valor de pagamento maior que zero.',
      });
      return;
    }

    if (receivedAmount > openAmount) {
      setFeedback({
        type: 'error',
        text: `O pagamento não pode ultrapassar ${formatCurrency(
          openAmount
        )}.`,
      });
      return;
    }

    setIsSettling(true);
    setFeedback(null);

    try {
      const result = await settleReceivable(
  selectedReceivable,
  receivedAmount,
  user
);

      setSelectedReceivable(null);
      setPaymentAmount('');
      setIsPaymentModalOpen(false);

      setFeedback({
        type: 'success',
        text:
          result.remainingAmount <= 0
            ? 'Dívida quitada com sucesso.'
            : `Pagamento registrado. Saldo restante: ${formatCurrency(
                result.remainingAmount
              )}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text:
          error.message ||
          'Não foi possível registrar o pagamento.',
      });
    } finally {
      setIsSettling(false);
    }
  };

  const handlePartialPayment = async (event) => {
    event.preventDefault();
    await handlePayment(paymentAmount);
  };

  const handleFullPayment = async () => {
    if (!selectedReceivable) return;

    await handlePayment(
      getOpenAmount(selectedReceivable)
    );
  };

  if (!canOperate()) {
    return (
      <div className="access-restricted">
        Seu usuário não possui permissão operacional.
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Fiado</h2>
        <p>
          Acompanhe recebimentos, pagamentos parciais e
          valores pendentes dos clientes.
        </p>
      </div>

      {feedback && (
        <div className={`notice notice-${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="summary-grid">
        <div className="stat-card">
          <span className="stat-card-label">
            Em aberto
          </span>

          <div className="stat-card-value">
            {openReceivables.length}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">
            Total a receber
          </span>

          <div className="stat-card-value stat-card-money">
            {formatCurrency(openTotal)}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">
            Pagamentos concluídos
          </span>

          <div className="stat-card-value">
            {
              receivables.filter(
                (item) => item.status === 'Pago'
              ).length
            }
          </div>
        </div>
      </div>

      <div className="table-toolbar">
        <label className="search-field">
          <Search size={17} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Buscar cliente"
          />
        </label>

        <WalletCards size={20} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Valor original</th>
              <th>Saldo pendente</th>
              <th>Data da venda</th>
              <th>Status</th>

              {canEdit() && <th>Ação</th>}
            </tr>
          </thead>

          <tbody>
            {filtered.map((receivable) => {
              const openAmount =
                getOpenAmount(receivable);

              const originalAmount = toNumber(
                receivable.valorOriginal ??
                  receivable.valor
              );

              const isPaid =
                receivable.status === 'Pago' ||
                openAmount <= 0;

              return (
                <tr key={receivable.id}>
                  <td>
                    <strong>
                      {receivable.clienteNome}
                    </strong>
                  </td>

                  <td>
                    {formatCurrency(originalAmount)}
                  </td>

                  <td>
                    <strong>
                      {formatCurrency(openAmount)}
                    </strong>
                  </td>

                  <td>
                    {formatDateTime(receivable.data)}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        isPaid
                          ? 'badge-green'
                          : 'badge-amber'
                      }`}
                    >
                      {isPaid
                        ? 'Pago'
                        : receivable.status ||
                          'Em aberto'}
                    </span>
                  </td>

                  {canEdit() && (
                    <td>
                      {!isPaid && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() =>
                            openPaymentModal(
                              receivable
                            )
                          }
                        >
                          <CheckCircle2 size={15} />
                          Registrar pagamento
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {isLoading && <tr><td colSpan={canEdit() ? 6 : 5} className="empty-state">Carregando fiados...</td></tr>}
            {!isLoading && !filtered.length && (
              <tr>
                <td
                  colSpan={canEdit() ? 6 : 5}
                  className="empty-state"
                >
                  Nenhum fiado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isPaymentModalOpen &&
        selectedReceivable && (
          <div
            className="modal-overlay"
            onMouseDown={closePaymentModal}
          >
            <form
              className="modal"
              onSubmit={handlePartialPayment}
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <div className="modal-heading">
                <div>
                  <h3>Registrar pagamento</h3>

                  <p>
                    Cliente:{' '}
                    <strong>
                      {
                        selectedReceivable.clienteNome
                      }
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={closePaymentModal}
                  disabled={isSettling}
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="summary-grid">
                <div className="stat-card">
                  <span className="stat-card-label">
                    Saldo pendente
                  </span>

                  <div className="stat-card-value stat-card-money">
                    {formatCurrency(
                      getOpenAmount(
                        selectedReceivable
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="payment-amount">
                  Valor recebido
                </label>

                <input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  max={getOpenAmount(
                    selectedReceivable
                  )}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target.value
                    )
                  }
                  placeholder="0,00"
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closePaymentModal}
                  disabled={isSettling}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-outline"
                  disabled={isSettling}
                >
                  {isSettling
                    ? 'Registrando...'
                    : 'Registrar parcial'}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFullPayment}
                  disabled={isSettling}
                >
                  {isSettling
                    ? 'Registrando...'
                    : 'Quitar tudo'}
                </button>
              </div>
            </form>
          </div>
        )}
    </div>
  );
}
