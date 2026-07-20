export const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
};

export const formatDate = (value) => {
  if (!value) return '—';

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(date);
};

export const formatDateTime = (value) => {
  if (!value) return '—';

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};