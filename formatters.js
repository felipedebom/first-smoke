export const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const formatDateTime = (value) => {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toNumber = (value) => Number(value || 0);
