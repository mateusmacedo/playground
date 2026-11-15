'use client';

import { CButton, CPlaceholder, CSpinner } from '@coreui/react';
import type { ReactNode } from 'react';

/** Lista ou página sem dados: o texto e, como filhos, a ação ("Nenhuma cotação ainda." com "Nova cotação"). */
export function EmptyState({
  message,
  children,
}: Readonly<{ message: string; children?: ReactNode }>) {
  return (
    <div className="text-center text-body-secondary py-5">
      <p className="mb-2">{message}</p>
      {children}
    </div>
  );
}

/**
 * Falha ao carregar, com o motivo e o botão da saída ("Tentar de novo", por padrão). Com `busy`, a nova tentativa está
 * em andamento: o botão fica travado e mostra o spinner.
 */
export function ErrorState({
  message = 'Não foi possível carregar os dados.',
  detail,
  actionLabel = 'Tentar de novo',
  busy = false,
  onRetry,
}: Readonly<{
  message?: string;
  detail?: string;
  actionLabel?: string;
  busy?: boolean;
  onRetry: () => void;
}>) {
  return (
    <div className="text-center py-5" role="alert">
      <p className="mb-1">{message}</p>
      {detail && <p className="small text-body-secondary mb-1">{detail}</p>}
      <CButton
        className="mt-2"
        color="primary"
        disabled={busy}
        onClick={onRetry}
        type="button"
        variant="outline"
      >
        {busy && <CSpinner aria-hidden="true" className="me-2" size="sm" />}
        {actionLabel}
      </CButton>
    </div>
  );
}

const PLACEHOLDER_WIDTHS = [12, 10, 11, 8, 9, 7] as const;

/** Carregamento com o placeholder do CoreUI: linhas que piscam no lugar do conteúdo. */
export function LoadingState({
  rows = 5,
  label = 'Carregando…',
}: Readonly<{ rows?: number; label?: string }>) {
  return (
    // WHY: o <output> já tem o papel `status` implícito; é inline por padrão, então o `d-block` mantém o bloco da div
    // que ele substitui, e as linhas são <span> em bloco porque o <output> só aceita conteúdo de fraseado.
    <output aria-busy="true" className="d-block py-2">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <CPlaceholder
          animation="glow"
          aria-hidden="true"
          as="span"
          className="d-block mb-2"
          // biome-ignore lint/suspicious/noArrayIndexKey: as linhas do esqueleto são estáticas e não têm identidade própria
          key={index}
        >
          <CPlaceholder
            xs={PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length]}
          />
        </CPlaceholder>
      ))}
    </output>
  );
}
