import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { loadCurrentAccess, type CurrentAccess } from '@/lib/crm/currentAccessRepository';

export function useCurrentAccess() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<CurrentAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setAccess(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadCurrentAccess(user.id)
      .then((value) => {
        if (!active) return;
        setAccess(value);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setAccess(null);
        setError('Não foi possível confirmar suas permissões agora.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, user]);

  return { access, loading: authLoading || loading, error };
}
