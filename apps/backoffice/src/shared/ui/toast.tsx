'use client';

import { CToast, CToastBody, CToaster, CToastHeader } from '@coreui/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ToastKind = 'success' | 'info' | 'warning' | 'danger';

export const TOAST_DELAY_MS = 5000;

const MARKER_COLORS: Readonly<Record<ToastKind, string>> = {
  success: 'var(--cui-success)',
  info: 'var(--cui-primary)',
  warning: 'var(--cui-warning)',
  danger: 'var(--cui-danger)',
};

const DEFAULT_TITLES: Readonly<Record<ToastKind, string>> = {
  success: 'Pronto',
  info: 'Aviso',
  warning: 'Atenção',
  danger: 'Erro',
};

const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' });

export interface ToastApi {
  show: (message: string, kind?: ToastKind, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  danger: (message: string, title?: string) => void;
}

interface ToastItem {
  readonly id: number;
  readonly kind: ToastKind;
  readonly title: string;
  readonly message: string;
  readonly time: string;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Toaster no canto superior direito, com marcador de cor, título, hora e fechamento automático. Vai uma vez na raiz;
 * os avisos são anunciados com `aria-live="polite"`, sem interromper a leitura.
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  // WHY: uma lista no estado, e não o `push` do CToaster, que guarda só o último aviso: dois `show()` no mesmo
  // instante são agrupados numa renderização e o primeiro se perderia.
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback(
    (message: string, kind: ToastKind = 'success', title?: string) => {
      nextId.current += 1;
      const toast: ToastItem = {
        id: nextId.current,
        kind,
        title: title ?? DEFAULT_TITLES[kind],
        message,
        time: timeFormat.format(new Date()),
      };
      setToasts((current) => [...current, toast]);
    },
    [],
  );

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) => show(message, 'success', title),
      info: (message, title) => show(message, 'info', title),
      warning: (message, title) => show(message, 'warning', title),
      danger: (message, title) => show(message, 'danger', title),
    }),
    [show],
  );

  return (
    <ToastContext value={api}>
      {children}
      <CToaster aria-live="polite" className="p-3" placement="top-end">
        {toasts.map((toast) => (
          <CToast
            autohide
            delay={TOAST_DELAY_MS}
            key={toast.id}
            // WHY: o CToast só avisa o fechamento depois da animação de saída; é aí que o aviso sai da lista.
            onClose={() => remove(toast.id)}
            visible
          >
            <CToastHeader closeButton>
              <svg
                aria-hidden="true"
                className="rounded me-2"
                focusable="false"
                height="20"
                width="20"
              >
                <rect
                  fill={MARKER_COLORS[toast.kind]}
                  height="100%"
                  width="100%"
                />
              </svg>
              <strong className="me-auto">{toast.title}</strong>
              <small>{toast.time}</small>
            </CToastHeader>
            <CToastBody>{toast.message}</CToastBody>
          </CToast>
        ))}
      </CToaster>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast precisa estar dentro do ToastProvider.');
  }
  return api;
}
