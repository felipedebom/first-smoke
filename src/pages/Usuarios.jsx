import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Save } from 'lucide-react';

export default function Usuarios() {
  const { canManage } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ role: 'funcionario', nome: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));
      setLoading(false);
    }, (error) => {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível carregar os usuários.' });
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openEdit = (u) => { setEditing(u.id); setForm({ role: u.role || 'funcionario', nome: u.nome || '' }); };

  const save = async () => {
    if (!editing) return;
    if (!form.nome.trim()) {
      setFeedback({ type: 'error', text: 'Informe o nome do usuário.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'usuarios', editing), { role: form.role, nome: form.nome.trim() });
      setEditing(null);
      setFeedback({ type: 'success', text: 'Usuário atualizado com sucesso.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'Não foi possível atualizar o usuário.' });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage()) return <div className="loading-screen">Acesso restrito ao Super Admin.</div>;

  const roleLabel = (r) => r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Funcionário';
  const roleBadge = (r) => r === 'super_admin' ? 'badge-blue' : r === 'admin' ? 'badge-green' : 'badge-amber';

  return (
    <div>
      <div className="page-header"><h2>Usuários</h2><p>Gerenciamento de permissões (Super Admin)</p></div>
      {feedback && <div className={`notice notice-${feedback.type}`} role="alert">{feedback.text}</div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Email</th><th>Função</th><th>Permissões</th><th>Ações</th></tr></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td><strong>{u.nome || '—'}</strong></td>
                <td>{u.email}</td>
                <td><span className={`badge ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span></td>
                <td style={{fontSize:13,color:'var(--muted)'}}>
                  {u.role === 'super_admin' ? 'Controle total do sistema' :
                   u.role === 'admin' ? 'Gerenciamento do negócio' : 'Acesso limitado'}
                </td>
                <td>
                  <button className="btn btn-outline btn-xs" onClick={() => openEdit(u)}><Shield size={14} /> Editar</button>
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan="5" className="empty-state">Carregando usuários...</td></tr>}
            {!loading && !usuarios.length && <tr><td colSpan="5" className="empty-state">Nenhum usuário cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <h3>Editar Permissões</h3>
            <div className="form-grid">
              <div className="form-group full"><label>Nome</label><input value={form.nome} onChange={e => setForm({...form,nome:e.target.value})} /></div>
              <div className="form-group full"><label>Função</label><select value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="funcionario">Funcionário</option></select></div>
            </div>
            <div style={{marginTop:16,padding:14,background:'var(--bg)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--muted)'}}>
              <strong>Super Admin:</strong> Controle técnico total · <strong>Admin:</strong> Controle do negócio · <strong>Funcionário:</strong> Acesso limitado
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
