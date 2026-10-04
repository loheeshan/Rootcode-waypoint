import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { DialogCard, type DialogLine } from '../../components/ui/DialogCard';
import { PinPad } from '../../components/ui/PinPad';
import { dialogs, type DialogDef, type DialogId } from './dialogs';

type OnAction = (key: string) => void;
type Override = { title?: string; body?: DialogLine[] };
type Ctx = {
  /** Open a dialog. `override` replaces its title/body text for this one time. */
  openDialog: (id: DialogId, onAction?: OnAction, override?: Override) => void;
  closeDialog: () => void;
};

const DialogContext = createContext<Ctx | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState<{ id: DialogId; override?: Override } | null>(null);
  const handler = useRef<OnAction | undefined>(undefined);
  const lastDef = useRef<DialogDef | null>(null);

  const openDialog = useCallback((id: DialogId, onAction?: OnAction, override?: Override) => {
    handler.current = onAction;
    setCurrent({ id, override });
  }, []);

  const closeDialog = useCallback(() => {
    handler.current = undefined;
    setCurrent(null);
  }, []);

  const value = useMemo(() => ({ openDialog, closeDialog }), [openDialog, closeDialog]);

  const base = current ? dialogs[current.id] : null;
  const def: DialogDef | null = base ? { ...base, ...current?.override } : null;
  if (def) lastDef.current = def;
  const shown = def ?? lastDef.current;

  const onAction = (key: string) => {
    if (!def) return;
    const action = def.actions.find((a) => a.key === key);
    const cb = handler.current;
    handler.current = undefined;

    if (action?.next) {
      setCurrent({ id: action.next });
    } else {
      setCurrent(null);
      if (action?.href) router.navigate(action.href as never);
    }
    cb?.(key); // runs last, so it can open another dialog
  };

  const onPinSuccess = () => {
    const cb = handler.current;
    handler.current = undefined;
    setCurrent(null);
    if (def?.successHref) router.navigate(def.successHref as never);
    cb?.('success');
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
      >
        {shown?.custom === 'pin' ? <PinPad onSuccess={onPinSuccess} /> : null}
      </DialogCard>
    </DialogContext.Provider>
  );
}