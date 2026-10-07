import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { loadCurrentAccess, getAccessRevision, subscribeAccessRevision, type CurrentAccess } from '@/lib/crm/currentAccessRepository';
import { sessionContext } from '@/lib/sessionContext';

export function useCurrentAccess() {
  const { user, loading: authLoading, organizationReady } = useAuth();
  const context = useSyncExternalStore(sessionContext.subscribe, sessionContext.get, sessionContext.get);
  const revision = useSyncExternalStore(subscribeAccessRevision, getAccessRevision, getAccessRevision);
  const [resolvedRevision, setResolvedRevision] = useState(-1);
  const [access, setAccess] = useState<CurrentAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAccess(null);
    if (authLoading || !organizationReady || !user) {
      setAccess(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadCurrentAccess(user.id)
      .then((value) => {
        if (!active) return;
        setAccess(value);
        setResolvedRevision(revision);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setAccess(null);
        setError('Não foi possível confirmar suas permissões agora.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, organizationReady, user, context, revision]);

  return { access: organizationReady && resolvedRevision === revision ? access : null, loading: authLoading || loading, error };
}
