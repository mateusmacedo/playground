import type { ReactNode } from 'react';

import { DefaultLayout } from '@/layout/default-layout';

/** Toda página dentro de `(painel)` ganha o menu lateral, o cabeçalho e o rodapé. */
export default function PainelLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
