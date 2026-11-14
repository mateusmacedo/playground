'use client';

import { ErrorScreen } from './error-screen';

// WHY: fica na raiz de `app/` para cobrir também o layout de `(painel)`; um `error.tsx` dentro do grupo não o envolveria.
export default function ErrorPage(
  props: Readonly<{ error: unknown; retry: () => void }>,
) {
  return <ErrorScreen {...props} />;
}
