import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { trackLogin } from "@/hooks/useLoginTracking";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Track OAuth logins (Microsoft)
        if (event === 'SIGNED_IN' && session?.user) {
          const provider = session.user.app_metadata?.provider;
          
          // Use setTimeout(0) to avoid potential deadlock
          setTimeout(() => {
            if (provider === 'azure') {
              trackLogin(session.user.id, 'azure');
            }
          }, 0);
        }

        // Track restored sessions (refresh token logins) if last login was > 8 hours ago
        if (event === 'INITIAL_SESSION' && session?.user) {
          setTimeout(async () => {
            try {
              const { data: lastActivity } = await supabase
                .from('user_activity_log')
                .select('created_at')
                .eq('user_id', session.user.id)
                .eq('action_type', 'login')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              const lastLoginTime = lastActivity?.created_at ? new Date(lastActivity.created_at) : null;
              const hoursSinceLastLogin = lastLoginTime 
                ? (Date.now() - lastLoginTime.getTime()) / (1000 * 60 * 60) 
                : 999;
              
              // If last login was more than 8 hours ago, register as new session
              if (hoursSinceLastLogin > 8) {
                const provider = session.user.app_metadata?.provider;
                trackLogin(session.user.id, provider === 'azure' ? 'azure' : 'email');
              }
            } catch (error) {
              console.error('Error checking last login:', error);
            }
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
