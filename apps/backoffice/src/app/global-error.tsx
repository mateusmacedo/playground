'use client';

import '../scss/styles.scss';

import { ErrorScreen, type ErrorScreenProps } from './error-screen';

// WHY: este arquivo substitui o layout raiz quando ele mesmo falha, então traz o próprio <html>, <body> e estilos.
// NOTE: fica no tema claro, porque o script de tema do layout raiz não roda neste documento.
export default function GlobalError(props: Readonly<ErrorScreenProps>) {
  return (
    <html lang="pt-BR">
      <body>
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
