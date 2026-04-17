import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getOrCreateUser, User as LolaUser } from '../lib/database';
import { logger } from '../lib/logger';

export interface UserPermissions {
  isAdmin: boolean;
  isEventMaker: boolean;
  isSpecial: boolean;
  roles: string[]; // ID ролей (для поиска в SERVER_ROLES)
  roleNames: Record<string, string>; // ID → название из Discord (для неизвестных ролей)
}

interface AuthContextType {
  user: LolaUser | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncDiscordXp: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1`;

async function fetchRoles(userId: string): Promise<UserPermissions | null> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/get-discord-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      logger.error(`Edge Function error: ${res.status}`);
      return null;
    }
    const data = await res.json();

    // Edge Function возвращает roles: [{ id, name }]
    if (data.roles && Array.isArray(data.roles)) {
      // Создаём мапу ID → название
      const roleNames: Record<string, string> = {};
      const roleIds: string[] = [];
      for (const r of data.roles) {
        const roleId = typeof r === 'string' ? r : r.id;
        const roleName = typeof r === 'string' ? r : r.name;
        roleIds.push(roleId);
        roleNames[roleId] = roleName;
      }
      data.roles = roleIds;
      data.roleNames = roleNames;
    } else {
      data.roleNames = {};
    }
    return data;
  } catch (e) {
    logger.error('fetchRoles error:', e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lolaUser, setLolaUser] = useState<LolaUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseUser) {
      setLolaUser(null);
      setPermissions(null);
      setLoading(false);
      return;
    }

    const loadLolaUser = async () => {
      setLoading(true);
      // Discord OAuth возвращает разные ключи в зависимости от версии API
      // Приоритет: name (Discord) > full_name > user_name > email prefix
      const username = supabaseUser.user_metadata?.name
        || supabaseUser.user_metadata?.user_name
        || supabaseUser.user_metadata?.full_name
        || supabaseUser.email?.split('@')[0]
        || 'User';
      const avatarUrl = supabaseUser.user_metadata?.avatar_url
        || supabaseUser.user_metadata?.avatar
        || supabaseUser.user_metadata?.picture;

      // Настоящий Discord ID (snowflake)
      const discordId = supabaseUser.user_metadata?.provider_id;

      const user = await getOrCreateUser(supabaseUser.id, discordId, username, avatarUrl);
      setLolaUser(user);

      // Загружаем роли автоматически через бота
      if (discordId) {
        const perms = await fetchRoles(discordId);
        if (perms) setPermissions(perms);
      }

      setLoading(false);
    };

    loadLolaUser();
  }, [supabaseUser]);

  const signInWithDiscord = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выхода');
    }
  };

  const refreshUser = async () => {
    if (!supabaseUser) return;
    const username = supabaseUser.user_metadata?.name
      || supabaseUser.user_metadata?.user_name
      || supabaseUser.user_metadata?.full_name
      || supabaseUser.email?.split('@')[0]
      || 'User';
    const avatarUrl = supabaseUser.user_metadata?.avatar_url
      || supabaseUser.user_metadata?.avatar
      || supabaseUser.user_metadata?.picture;
    const discordId = supabaseUser.user_metadata?.provider_id || null;
    const user = await getOrCreateUser(supabaseUser.id, discordId, username, avatarUrl);
    setLolaUser(user);

    if (discordId) {
      const perms = await fetchRoles(discordId);
      if (perms) setPermissions(perms);
    }
  };

  const syncDiscordXp = async () => {
    if (!supabaseUser) return;
    const discordId = supabaseUser.user_metadata?.provider_id || supabaseUser.id;
    try {
      const res = await fetch(`${FUNCTIONS_URL}/sync-juniper-xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId }),
      });
      if (res.ok) {
        await refreshUser();
      }
    } catch (e) {
      logger.error('syncDiscordXp error:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: lolaUser,
        supabaseUser,
        session,
        permissions,
        loading,
        error,
        signInWithDiscord,
        signOut,
        refreshUser,
        syncDiscordXp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
