import { ErrorState, LoadingState } from '@/shared/ui/states';

import type { LoadPhase } from './store/load-phase';

export interface BoardLoadStateProps {
  /** A leitura em andamento ou a que falhou. */
  readonly phase: LoadPhase;
  readonly loadingLabel: string;
  readonly failedMessage: string;
  readonly onRetry: () => void;
}

/** O que aparece no lugar do que vem do servidor enquanto ele não chega: a espera, ou a falha com "Tentar de novo". */
export function BoardLoadState({
  phase,
  loadingLabel,
  failedMessage,
  onRetry,
}: Readonly<BoardLoadStateProps>) {
  if (phase.kind === 'failed') {
    return (
      <ErrorState
        message={failedMessage}
        detail={phase.message}
        onRetry={onRetry}
      />
    );
  }
  return <LoadingState label={loadingLabel} />;
}
