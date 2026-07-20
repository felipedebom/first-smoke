import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Clock, User } from 'lucide-react';

export default function Historico() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('data', 'desc'), limit(200));
    const unsub = onSnapshot(q, snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());

  return (
    <div>
      <div className="page-header"><h2>Histórico</h2><p>Registro de todas as alterações do sistema</p></div>

      <div className="dashboard-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="stat-card"><span className="stat-card-label">Registros Hoje</span><div className="stat-card-value">{logs.filter(l => (l.data?.toDate?.()||0) >= hoje).length}</div></div>
        <div className="stat-card"><span className="stat-card-label">Registros na Semana</span><div className="stat-card-value">{logs.filter(l => (l.data?.toDate?.()||0) >= inicioSemana).length}</div></div>
        <div className="stat-card"><span className="stat-card-label">Total de Registros</span><div className="stat-card-value">{logs.length}</div></div>
      </div>

      <div className="report-section">
        <div className="timeline-log">
          {logs.map(l => {
            const d = l.data?.toDate?.() || new Date();
            const dataStr = d.toLocaleDateString('pt-BR');
            const horaStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={l.id} className="timeline-log-item">
                <div className="timeline-log-icon"><Clock size={16} /></div>
                <div className="timeline-log-text">
                  <p>{l.acao}</p>
                  <span><User size={12} style={{display:'inline',verticalAlign:'middle',marginRight:4}} />{l.usuario} · {dataStr} às {horaStr}</span>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>Nenhum registro encontrado</div>}
        </div>
      </div>
    </div>
  );
}