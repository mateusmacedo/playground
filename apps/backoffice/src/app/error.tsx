'use client';

import { ErrorScreen, type ErrorScreenProps } from './error-screen';

// WHY: fica na raiz de `app/` para cobrir também o layout de `(painel)`; um `error.tsx` dentro do grupo não o envolveria.
export default function ErrorPage(props: Readonly<ErrorScreenProps>) {
  return <ErrorScreen {...props} />;
}
