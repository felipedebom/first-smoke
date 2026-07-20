import { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuth, getUserProfile, logout } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase user
  const [profile, setProfile] = useState(null);  // role + nome
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribe = onAuth(async (firebaseUser) => {
    setUser(firebaseUser);

    try {
      if (!firebaseUser) {
        setProfile(null);
        return;
      }

      const userProfile = await getUserProfile(firebaseUser.uid);

console.log('UID LOGADO:', firebaseUser.uid);
console.log('PROFILE:', userProfile);

      if (userProfile) {
        setProfile(userProfile);
      } else {
        console.error(
          'Perfil não encontrado no Firestore para o UID:',
          firebaseUser.uid
        );

        setProfile({
          nome: firebaseUser.email,
          role: 'sem_permissao',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);

      setProfile({
        nome: firebaseUser?.email || 'Usuário',
        role: 'sem_permissao',
      });
    } finally {
      setLoading(false);
    }
  });

  return unsubscribe;
}, []);

  const signOut = () => logout();

  // helpers de permissão
  const isAdmin   = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuper   = profile?.role === 'super_admin';
  const canEdit   = () => isAdmin || isSuper;
  const canManage = () => isSuper;
  const canOperate = () => Boolean(user) && profile?.role !== 'sem_permissao';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, isAdmin, isSuper, canEdit, canManage, canOperate }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
