import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, getUserProfile, logout } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuth(async (firebaseUser) => {
    setUser(firebaseUser);
    setProfile(null);
    setProfileError(null);
    setLoading(true);

    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    try {
      const userProfile = await getUserProfile(firebaseUser.uid);

      if (!userProfile) {
        setProfileError('Seu perfil não foi encontrado. Confirme se o documento em usuarios usa o mesmo UID da autenticação.');
        return;
      }

      setProfile({ ...userProfile, uid: firebaseUser.uid });
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
      setProfileError(
        error?.code === 'permission-denied'
          ? 'O perfil não pôde ser lido por falta de permissão no Firestore.'
          : 'Não foi possível carregar seu perfil. Tente entrar novamente.',
      );
    } finally {
      setLoading(false);
    }
  }), []);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuper = profile?.role === 'super_admin';
  const canEdit = () => isAdmin;
  const canManage = () => isSuper;
  const canOperate = () => Boolean(user && profile);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      profileError,
      loading,
      signOut: logout,
      isAdmin,
      isSuper,
      canEdit,
      canManage,
      canOperate,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
