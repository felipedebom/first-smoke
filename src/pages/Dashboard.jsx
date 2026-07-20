import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { db } from '../firebase';
import {
  formatCurrency,
  formatDateTime,
  toNumber,
} from '../../formatters';

const sameDay = (firstDate, secondDate) => (
  firstDate.getDate() === secondDate.getDate()
  && firstDate.getMonth() === secondDate.getMonth()
  && firstDate.getFullYear() === secondDate.getFullYear()
);

const timestampDate = (value) => (
  value?.toDate?.() || (value ? new Date(value) : null)
);

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let productsLoaded = false;
    let salesLoaded = false;
    let receivablesLoaded = false;

    const finishLoading = () => {
      if (productsLoaded && salesLoaded && receivablesLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeProducts = onSnapshot(
      collection(db, 'produtos'),
      (snapshot) => {
        setProducts(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })),
        );

        productsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error('Erro ao carregar produtos:', error);
        productsLoaded = true;
        finishLoading();
      },
    );

    const unsubscribeSales = onSnapshot(
      collection(db, 'vendas'),
      (snapshot) => {
        setSales(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })),
        );

        salesLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error('Erro ao carregar vendas:', error);
        salesLoaded = true;
        finishLoading();
      },
    );

    const unsubscribeReceivables = onSnapshot(
      collection(db, 'fiados'),
      (snapshot) => {
        setReceivables(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })),
        );

        receivablesLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error('Erro ao carregar fiados:', error);
        receivablesLoaded = true;
        finishLoading();
      },
    );

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
      unsubscribeReceivables();
    };
  }, []);

  const overview = useMemo(() => {
    const now = new Date();

    const salesToday = sales.filter((sale) => {
      const saleDate = timestampDate(sale.data);
      return saleDate && sameDay(saleDate, now);
    });

    const salesMonth = sales.filter((sale) => {
      const saleDate = timestampDate(sale.data);

      return (
        saleDate
        && saleDate.getMonth() === now.getMonth()
        && saleDate.getFullYear() === now.getFullYear()
      );
    });

    const topProductMap = new Map();

    sales.forEach((sale) => {
      sale.itens?.forEach((item) => {
        const productName = item.nome || 'Produto sem nome';
        const currentQuantity = topProductMap.get(productName) || 0;

        topProductMap.set(
          productName,
          currentQuantity + toNumber(item.quantidade),
        );
      });
    });

    const topProducts = [...topProductMap.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5);

    const paymentTotals = salesMonth.reduce((totals, sale) => {
      const paymentMethod = sale.pagamento || 'Não informado';

      totals[paymentMethod] = (
        totals[paymentMethod] || 0
      ) + toNumber(sale.total);

      return totals;
    }, {});

    const week = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now);

      day.setHours(0, 0, 0, 0);
      day.setDate(now.getDate() - (6 - index));

      const total = sales
        .filter((sale) => {
          const saleDate = timestampDate(sale.data);
          return saleDate && sameDay(saleDate, day);
        })
        .reduce(
          (sum, sale) => sum + toNumber(sale.total),
          0,
        );

      return {
        id: day.toISOString(),
        label: day
          .toLocaleDateString('pt-BR', { weekday: 'short' })
          .replace('.', ''),
        value: total,
      };
    });

    const todayTotal = salesToday.reduce(
      (sum, sale) => sum + toNumber(sale.total),
      0,
    );

    const monthTotal = salesMonth.reduce(
      (sum, sale) => sum + toNumber(sale.total),
      0,
    );

    const inventoryValue = products.reduce(
      (sum, product) => (
        sum
        + (
          toNumber(product.estoque)
          * toNumber(product.precoCusto ?? product.precoVenda)
        )
      ),
      0,
    );

    const openReceivables = receivables
      .filter((receivable) => receivable.status !== 'Pago')
      .reduce((sum, receivable) => {
        const remainingValue = (
          receivable.saldoRestante
          ?? receivable.valorRestante
          ?? receivable.valor
        );

        return sum + toNumber(remainingValue);
      }, 0);

    const averageTicket = salesMonth.length
      ? monthTotal / salesMonth.length
      : 0;

    const recentSales = [...sales]
      .sort((first, second) => {
        const firstDate = timestampDate(first.data)?.getTime() || 0;
        const secondDate = timestampDate(second.data)?.getTime() || 0;

        return secondDate - firstDate;
      })
      .slice(0, 6);

    return {
      todayTotal,
      monthTotal,
      salesTodayCount: salesToday.length,
      salesMonthCount: salesMonth.length,
      inventoryValue,
      openReceivables,
      averageTicket,
      topProducts,
      paymentTotals,
      week,
      recentSales,
    };
  }, [products, receivables, sales]);

  const maxWeekValue = Math.max(
    ...overview.week.map((day) => day.value),
    1,
  );

  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner" />

        <div>
          <strong>Carregando dashboard</strong>
          <span>Buscando as informações da FIRST SMOKE.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            Visão geral
          </span>

          <h2>Dashboard</h2>

          <p>
            Acompanhe os principais resultados da FIRST SMOKE.
          </p>
        </div>

        <div className="dashboard-date">
          <CalendarDays size={17} />
          <span>{currentDate}</span>
        </div>
      </header>

      <section className="metric-grid dashboard-metrics">
        <article className="metric-card metric-card-highlight">
          <div className="metric-card-top">
            <div className="metric-icon">
              <Wallet size={20} />
            </div>

            <span className="metric-status">
              Hoje
            </span>
          </div>

          <span>Faturamento de hoje</span>
          <strong>{formatCurrency(overview.todayTotal)}</strong>

          <small>
            {overview.salesTodayCount}{' '}
            {overview.salesTodayCount === 1 ? 'venda realizada' : 'vendas realizadas'}
          </small>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <div className="metric-icon">
              <BarChart3 size={20} />
            </div>
          </div>

          <span>Faturamento no mês</span>
          <strong>{formatCurrency(overview.monthTotal)}</strong>

          <small>
            {overview.salesMonthCount}{' '}
            {overview.salesMonthCount === 1 ? 'venda registrada' : 'vendas registradas'}
          </small>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <div className="metric-icon">
              <ReceiptText size={20} />
            </div>
          </div>

          <span>Ticket médio mensal</span>
          <strong>{formatCurrency(overview.averageTicket)}</strong>

          <small>
            Média por venda no mês atual
          </small>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <div className="metric-icon">
              <PackageSearch size={20} />
            </div>
          </div>

          <span>Valor em estoque</span>
          <strong>{formatCurrency(overview.inventoryValue)}</strong>

          <small>
            {products.length}{' '}
            {products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
          </small>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <div className="metric-icon">
              <CreditCard size={20} />
            </div>
          </div>

          <span>Fiado em aberto</span>
          <strong>{formatCurrency(overview.openReceivables)}</strong>

          <small>
            Valores ainda não quitados
          </small>
        </article>
      </section>

      <section className="dashboard-primary-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-label">
                Desempenho semanal
              </span>

              <h3>Vendas dos últimos 7 dias</h3>

              <p>
                Faturamento registrado em cada dia.
              </p>
            </div>

            <div className="panel-heading-icon">
              <BarChart3 size={21} />
            </div>
          </div>

          <div className="week-chart">
            {overview.week.map((day) => (
              <div
                className="chart-bar-group"
                key={day.id}
              >
                <span className="chart-value">
                  {day.value
                    ? formatCurrency(day.value)
                    : 'R$ 0'}
                </span>

                <div className="chart-track">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${Math.max(
                        (day.value / maxWeekValue) * 100,
                        day.value ? 5 : 0,
                      )}%`,
                    }}
                  />
                </div>

                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-label">
                Produtos
              </span>

              <h3>Mais vendidos</h3>

              <p>
                Quantidade acumulada em vendas.
              </p>
            </div>

            <div className="panel-heading-icon">
              <ShoppingBag size={21} />
            </div>
          </div>

          <div className="rank-list">
            {overview.topProducts.map(([name, quantity], index) => (
              <div
                className="rank-item"
                key={name}
              >
                <span>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <strong>{name}</strong>
                <b>{quantity} un.</b>
              </div>
            ))}

            {!overview.topProducts.length && (
              <div className="empty-state dashboard-empty-state">
                As vendas concluídas aparecerão aqui.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-label">
                Movimentações
              </span>

              <h3>Últimas vendas</h3>

              <p>
                Vendas concluídas recentemente.
              </p>
            </div>
          </div>

          <div className="compact-list">
            {overview.recentSales.map((sale) => (
              <div
                className="compact-list-item"
                key={sale.id}
              >
                <div>
                  <strong>
                    {sale.clienteNome || 'Venda direta'}
                  </strong>

                  <span>
                    {sale.itens
                      ?.map((item) => item.nome)
                      .join(', ') || 'Venda sem itens'}
                  </span>

                  <small>
                    {formatDateTime(sale.data)}
                    {' · '}
                    {sale.pagamento || 'Pagamento não informado'}
                  </small>
                </div>

                <b>{formatCurrency(sale.total)}</b>
              </div>
            ))}

            {!overview.recentSales.length && (
              <div className="empty-state dashboard-empty-state">
                Nenhuma venda registrada.
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-label">
                Recebimentos
              </span>

              <h3>Formas de pagamento</h3>

              <p>
                Distribuição das vendas do mês.
              </p>
            </div>
          </div>

          <div className="payment-list">
            {Object.entries(overview.paymentTotals)
              .sort((first, second) => second[1] - first[1])
              .map(([method, total]) => {
                const percentage = overview.monthTotal
                  ? (total / overview.monthTotal) * 100
                  : 0;

                return (
                  <div
                    className="payment-item"
                    key={method}
                  >
                    <div className="payment-item-heading">
                      <span>{method}</span>
                      <strong>{formatCurrency(total)}</strong>
                    </div>

                    <div className="payment-progress">
                      <div
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <small>
                      {percentage.toFixed(1).replace('.', ',')}% do faturamento mensal
                    </small>
                  </div>
                );
              })}

            {!Object.keys(overview.paymentTotals).length && (
              <div className="empty-state dashboard-empty-state">
                Sem pagamentos registrados neste mês.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}