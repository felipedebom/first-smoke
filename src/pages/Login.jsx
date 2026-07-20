import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { login } from '../firebase';

const loginErrors = {
  'auth/invalid-credential': 'E-mail ou senha inválidos.',
  'auth/user-not-found': 'E-mail ou senha inválidos.',
  'auth/wrong-password': 'E-mail ou senha inválidos.',
  'auth/invalid-email': 'Informe um e-mail válido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

 const handleSubmit = async (event) => {
  event.preventDefault();
  setErro('');
  setLoading(true);

  try {
    await login(email.trim(), senha);
    navigate('/');
  } catch (error) {
    console.error('Erro completo do Firebase:', error);
    console.error('Código do erro:', error.code);
    console.error('Mensagem do erro:', error.message);

    setErro(
      loginErrors[error.code] ||
      `Erro ao entrar: ${error.code || 'erro desconhecido'}`
    );
  } finally {
    setLoading(false);
  }
};
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-icon"><LockKeyhole size={22} /></div>
        <h1>First<span> Smoke</span></h1>
        <p>Acesse o sistema de gestão da loja.</p>
        {erro && <div className="login-error" role="alert">{erro}</div>}
        <label htmlFor="login-email">E-mail</label>
        <input id="login-email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={senha} onChange={(event) => setSenha(event.target.value)} required />
        <button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no sistema'}</button>
        <small className="login-help">Seu acesso é criado pelo administrador do sistema.</small>
      </form>
    </main>
  );
}
