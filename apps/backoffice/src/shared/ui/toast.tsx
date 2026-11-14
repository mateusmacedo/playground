'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CToast, CToastBody, CToastHeader, CToaster } from '@coreui/react';

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

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Toaster no canto superior direito, com marcador de cor, título, hora e fechamento automático. Vai uma vez na raiz;
 * os avisos são anunciados com `aria-live="polite"`, sem interromper a leitura.
 */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [pushed, setPushed] = useState<
    ReactElement<ComponentProps<typeof CToast>> | undefined
  >();

  const show = useCallback(
    (message: string, kind: ToastKind = 'success', title?: string) => {
      setPushed(
        <CToast autohide delay={TOAST_DELAY_MS}>
          <CToastHeader closeButton>
            <svg
              aria-hidden="true"
              className="rounded me-2"
              focusable="false"
              height="20"
              width="20"
            >
              <rect fill={MARKER_COLORS[kind]} height="100%" width="100%" />
            </svg>
            <strong className="me-auto">{title ?? DEFAULT_TITLES[kind]}</strong>
            <small>{timeFormat.format(new Date())}</small>
          </CToastHeader>
          <CToastBody>{message}</CToastBody>
        </CToast>,
      );
    },
    [],
  );

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
      <CToaster
        aria-live="polite"
        className="p-3"
        placement="top-end"
        push={pushed}
      />
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
