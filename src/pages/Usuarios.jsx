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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), snap => setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const openEdit = (u) => { setEditing(u.id); setForm({ role: u.role || 'funcionario', nome: u.nome || '' }); };

  const save = async () => {
    if (!editing) return;
    await updateDoc(doc(db, 'usuarios', editing), { role: form.role, nome: form.nome });
    setEditing(null);
  };

  if (!canManage()) return <div className="loading-screen">Acesso restrito ao Super Admin.</div>;

  const roleLabel = (r) => r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'Funcionário';
  const roleBadge = (r) => r === 'super_admin' ? 'badge-blue' : r === 'admin' ? 'badge-green' : 'badge-amber';

  return (
    <div>
      <div className="page-header"><h2>Usuários</h2><p>Gerenciamento de permissões (Super Admin)</p></div>

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
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Editar Permissões</h3>
            <div className="form-grid">
              <div className="form-group full"><label>Nome</label><input value={form.nome} onChange={e => setForm({...form,nome:e.target.value})} /></div>
              <div className="form-group full"><label>Função</label><select value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="funcionario">Funcionário</option></select></div>
            </div>
            <div style={{marginTop:16,padding:14,background:'var(--bg)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--muted)'}}>
              <strong>Super Admin:</strong> Controle técnico total · <strong>Admin:</strong> Controle do negócio · <strong>Funcionário:</strong> Acesso limitado
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}><Save size={16} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}