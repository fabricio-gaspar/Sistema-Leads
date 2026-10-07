import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { listenForContextInvalidation, sessionContext } from '@/lib/sessionContext';

let signedOutIntentionally = false;

export function beginAuthIntent(intent: 'login' | 'register' | 'logout'): void {
  signedOutIntentionally = intent === 'logout';
  sessionContext.replace(null);
}

export const acceptsAuthenticatedEvents = () => !signedOutIntentionally;

/** Single Auth subscription. No awaited Supabase operation runs inside its callback. */
export function observeAuthContext(callbacks: {
  identity: (user: User | null) => void;
  loading: (loading: boolean) => void;
  organizationError: (error: string | null) => void;
}): () => void {
  let active = true;
  let eventVersion = 0;
  const accept = (user: User | null) => {
    if (!active || (user && signedOutIntentionally)) return;
    const pending = sessionContext.replace(user?.id ?? null);
    callbacks.identity(user); callbacks.organizationError(null); callbacks.loading(false);
    if (user) setTimeout(() => {
      if (!active || !sessionContext.isCurrent(pending)) return;
      void resolveOrganizationSession().catch(() => {
        if (active && sessionContext.isCurrent(pending)) callbacks.organizationError('Não foi possível confirmar o acesso à organização.');
      });
    }, 0);
  };
  const restore = async () => {
    const version = eventVersion;
    const generation = sessionContext.get();
    try {
      const { data, error } = await supabase.auth.getSession();
      if (active && version === eventVersion && sessionContext.isCurrent(generation)) accept(error ? null : data.session?.user ?? null);
    } catch {
      if (active && version === eventVersion && sessionContext.isCurrent(generation)) accept(null);
    }
  };
  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    eventVersion++;
    accept(session?.user ?? null);
  });
  const stopSignals = listenForContextInvalidation((reason) => {
    eventVersion++;
    if (reason === 'signout') signedOutIntentionally = true;
    callbacks.identity(null); callbacks.organizationError(null);
    callbacks.loading(reason !== 'signout' && !signedOutIntentionally);
    if (reason === 'refresh' && !signedOutIntentionally) void restore();
  });
  void restore();
  return () => { active = false; stopSignals(); subscription.subscription.unsubscribe(); };
}
