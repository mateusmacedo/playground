import { ErrorState } from '@/shared/ui/states';

/**
 * Só o `digest` vai para a tela: ele casa com o log do servidor. A `message` pode trazer detalhe interno e nunca é
 * mostrada. O Next entrega `error` como `unknown`, porque um valor lançado no cliente nem sempre é um `Error`.
 */
export function getErrorDigest(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest !== ''
  ) {
    return error.digest;
  }
  return undefined;
}

/** Tela de erro inesperado, usada pelo `error.tsx` e pelo `global-error.tsx`. */
export function ErrorScreen({
  error,
  retry,
}: Readonly<{ error: unknown; retry: () => void }>) {
  const digest = getErrorDigest(error);

  return (
    <main className="container">
      <ErrorState
        detail={digest ? `Código do erro: ${digest}` : undefined}
        message="Algo deu errado ao abrir esta página."
        // WHY: o botão entrega o evento de clique ao handler; o `retry` do Next não recebe argumento.
        onRetry={() => retry()}
      />
    </main>
  );
}
