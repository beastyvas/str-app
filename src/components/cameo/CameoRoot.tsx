import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Cameo } from './Cameo';
import { useCameoStore } from './useCameoStore';

/** Root mount: hydrates per-user cameo settings/history and renders the queue. */
export function CameoRoot() {
  const { user } = useAuth();
  const hydrate = useCameoStore(s => s.hydrate);
  useEffect(() => { hydrate(user?.id ?? null); }, [user?.id]);
  return <Cameo />;
}
