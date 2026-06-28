import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
// Lazy — native module only available in real iOS builds
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
try { AppleAuthentication = require('expo-apple-authentication'); } catch {}
import { supabase } from '@/lib/supabase';
import { UserRow } from '@/lib/database.types';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserRow | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) console.error('[useAuth] fetchProfile error:', error.message, error.code);
    if (data) setProfile(data);

    // Record EULA acceptance server-side once (the login screen gates account
    // creation on agreement and sets this local flag) — Guideline 1.2.
    if (data && !(data as any).eula_accepted_at) {
      try {
        const AS = (await import('@react-native-async-storage/async-storage')).default;
        if ((await AS.getItem('eula_accepted')) === 'true') {
          await supabase.from('users').update({ eula_accepted_at: new Date().toISOString() }).eq('id', userId);
        }
      } catch {}
    }

    // Identify user in RevenueCat (skip in Expo Go)
    try {
      const Constants = require('expo-constants').default;
      if (Constants.appOwnership !== 'expo') {
        const Purchases = require('react-native-purchases').default;
        await Purchases.logIn(userId);
      }
    } catch {
      // RC not available
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Use Expo auth proxy for Expo Go (stable URL, not LAN IP that changes)
    // For real builds (str:// scheme), use native redirect
    const isExpoGo = (await import('expo-constants')).default.appOwnership === 'expo';
    // In Expo Go: makeRedirectUri() auto-generates the right proxy/exp URL
    // In real build: use str:// scheme
    const redirectUri = isExpoGo
      ? AuthSession.makeRedirectUri()
      : AuthSession.makeRedirectUri({ scheme: 'str' });
    console.log('[Auth] redirectUri:', redirectUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    console.log('[Auth] browser result type:', result.type);
    if (result.type === 'success') {
      console.log('[Auth] success url:', result.url);
      const url = result.url;
      // Handle both hash (#) and query (?) params depending on flow
      const hashParams = new URL(url).hash
        .substring(1)
        .split('&')
        .reduce<Record<string, string>>((acc, param) => {
          const [k, v] = param.split('=');
          if (k) acc[k] = decodeURIComponent(v ?? '');
          return acc;
        }, {});

      const searchParams = Object.fromEntries(new URL(url).searchParams.entries());
      const params = { ...searchParams, ...hashParams };

      if (params.access_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      } else if (params.code) {
        await supabase.auth.exchangeCodeForSession(params.code);
      }
    }
  };

  const signInWithApple = async () => {
    if (!AppleAuthentication) throw new Error('Apple Authentication not available on this platform');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('No identity token from Apple');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signInWithGoogle,
        signInWithApple,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
