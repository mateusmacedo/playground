'use client';

import type { ReactNode } from 'react';
import { CButton, CPlaceholder } from '@coreui/react';

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

/** Falha ao carregar, com o motivo e o botão da saída ("Tentar de novo", por padrão). */
export function ErrorState({
  message = 'Não foi possível carregar os dados.',
  detail,
  actionLabel = 'Tentar de novo',
  onRetry,
}: Readonly<{
  message?: string;
  detail?: string;
  actionLabel?: string;
  onRetry: () => void;
}>) {
  return (
    <div className="text-center py-5" role="alert">
      <p className="mb-1">{message}</p>
      {detail && <p className="small text-body-secondary mb-1">{detail}</p>}
      <CButton
        className="mt-2"
        color="primary"
        onClick={onRetry}
        type="button"
        variant="outline"
      >
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
    <div aria-busy="true" className="py-2" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <CPlaceholder
          animation="glow"
          aria-hidden="true"
          as="p"
          className="mb-2"
          key={index}
        >
          <CPlaceholder
            xs={PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length]}
          />
        </CPlaceholder>
      ))}
    </div>
  );
}
