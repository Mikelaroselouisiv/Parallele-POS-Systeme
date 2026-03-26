import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 3000;

export type AutoClearMessageOptions = {
  /** Si true, le message ne disparaît pas tout seul (erreurs de chargement, etc.). */
  persist?: boolean;
};

/**
 * Message d’interface avec effacement automatique après `delayMs` (défaut 3 s),
 * sauf si le texte est vide ou si `persist: true`.
 */
export function useAutoClearMessage(delayMs = DEFAULT_DELAY_MS) {
  const [msg, setMsgState] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setMsg = useCallback(
    (text: string, options?: AutoClearMessageOptions) => {
      clearTimer();
      setMsgState(text);
      const persist = options?.persist === true;
      if (text && !persist) {
        timeoutRef.current = setTimeout(() => {
          setMsgState('');
          timeoutRef.current = null;
        }, delayMs);
      }
    },
    [clearTimer, delayMs],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [msg, setMsg] as const;
}
