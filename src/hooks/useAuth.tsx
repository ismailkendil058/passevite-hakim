import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPersistentAuth, setPersistentAuth, clearPersistentAuth } from '@/lib/utils';

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null; data: any }>;
  signOut: () => Promise<void>;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Check cookies/localStorage for a manual session
    const savedUser = getPersistentAuth('passevite_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setUserRole(parsed.role);
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      // Query our custom 'roles' table
      const { data, error } = await (supabase as any)
        .from('roles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return { error: new Error('Identifiants incorrects'), data: null };
      }

      const mockUser = {
        id: data.id,
        email: `${data.username}@gmail.com`,
        username: data.username,
        role: data.role
      };

      setPersistentAuth('passevite_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setUserRole(data.role);

      return { error: null, data: { user: mockUser } };
    } catch (e) {
      return { error: e as Error, data: null };
    }
  };

  const signOut = async () => {
    clearPersistentAuth('passevite_user');
    clearPersistentAuth('doctor_auth');
    setUser(null);
    setUserRole(null);
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    signIn,
    signOut,
    userRole
  }), [user, loading, userRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
