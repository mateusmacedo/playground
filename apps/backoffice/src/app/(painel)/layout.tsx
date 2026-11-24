import type { ReactNode } from 'react';

import { DefaultLayout } from '@/layout/default-layout';

interface PainelLayoutProps {
  readonly children: ReactNode;
}

/** Toda página dentro de `(painel)` ganha o menu lateral, o cabeçalho e o rodapé. */
export default function PainelLayout({
  children,
}: Readonly<PainelLayoutProps>) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
