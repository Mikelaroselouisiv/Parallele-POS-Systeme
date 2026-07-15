import { useCallback, useEffect, useState } from 'react';
import { pendingSalesCount } from '@/services/offline-queue';
import { onPendingSalesChanged } from '@/utils/eventBus';

export function usePendingSalesCount(): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    pendingSalesCount()
      .then(setCount)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    return onPendingSalesChanged(refresh);
  }, [refresh]);

  return count;
}
