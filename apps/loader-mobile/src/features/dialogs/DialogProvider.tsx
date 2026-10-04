import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { DialogCard } from '../../components/ui/DialogCard';
import { dialogs, type DialogDef, type DialogId } from './dialogs';

type OnAction = (key: string) => void;
type Ctx = { openDialog: (id: DialogId, onAction?: OnAction) => void; closeDialog: () => void };

const DialogContext = createContext<Ctx | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState<DialogId | null>(null);
  const handler = useRef<OnAction | undefined>(undefined);
  const lastDef = useRef<DialogDef | null>(null);

  const openDialog = useCallback((id: DialogId, onAction?: OnAction) => {
    handler.current = onAction;
    setCurrent(id);
  }, []);

  const closeDialog = useCallback(() => {
    handler.current = undefined;
    setCurrent(null);
  }, []);

  const value = useMemo(() => ({ openDialog, closeDialog }), [openDialog, closeDialog]);

  const def = current ? dialogs[current] : null;
  if (def) lastDef.current = def;
  const shown = def ?? lastDef.current;

  const onAction = (key: string) => {
    if (!def) return;
    const action = def.actions.find((a) => a.key === key);
    const cb = handler.current;
    handler.current = undefined;
    cb?.(key);

    if (action?.next) {
      setCurrent(action.next);
    } else {
      setCurrent(null);
      if (action?.href) router.navigate(action.href as never);
    }
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogCard
        visible={def !== null}
        title={shown?.title ?? ''}
        body={shown?.body ?? []}
        actions={shown?.actions ?? []}
        onAction={onAction}
        onClose={closeDialog}
      />
    </DialogContext.Provider>
  );
}