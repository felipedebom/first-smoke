import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Clock, Search, User } from 'lucide-react';
import { db } from '../firebase';
import { formatDateTime } from '../utils/formatters';

const PAGE_SIZE = 25;

export default function Historico() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('todos');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(
    query(collection(db, 'logs'), orderBy('data', 'desc'), limit(500)),
    (snapshot) => {
      setLogs(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    },
    (snapshotError) => {
      setError(snapshotError.message || 'Não foi possível carregar o histórico.');
      setLoading(false);
    },
  ), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return logs.filter((item) => {
      const matchesType = type === 'todos' || item.tipo === type;
      const content = `${item.acao || ''} ${item.usuario || ''}`.toLocaleLowerCase('pt-BR');
      return matchesType && (!term || content.includes(term));
    });
  }, [logs, search, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleLogs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const types = [...new Set(logs.map((item) => item.tipo).filter(Boolean))].sort();

  useEffect(() => setPage(1), [search, type]);

  return (
    <div>
      <div className="page-header"><h2>Histórico</h2><p>Consulte as alterações registradas no sistema.</p></div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="table-toolbar">
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ação ou usuário" /></label>
        <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo">
          <option value="todos">Todos os tipos</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span>{filtered.length} registro(s)</span>
      </div>
      <section className="report-section">
        <div className="timeline-log">
          {visibleLogs.map((item) => (
            <div key={item.id} className="timeline-log-item">
              <div className="timeline-log-icon"><Clock size={16} /></div>
              <div className="timeline-log-text"><p>{item.acao}</p><span><User size={12} /> {item.usuario || 'Sistema'} · {formatDateTime(item.data)}</span></div>
            </div>
          ))}
          {loading && <div className="empty-state">Carregando histórico...</div>}
          {!loading && !visibleLogs.length && <div className="empty-state">Nenhum registro corresponde aos filtros.</div>}
        </div>
      </section>
      {pageCount > 1 && <div className="pagination"><button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {pageCount}</span><button className="btn btn-outline btn-sm" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Próxima</button></div>}
    </div>
  );
}
