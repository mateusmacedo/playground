import type { Notify } from './board-notices';
import type { BoardLane } from './model/board';
import { lockedLaneOf } from './model/lane-state';

/** Mudança que mexe num card e, às vezes, o leva para outra coluna. */
export interface LockCheck {
  readonly cardId: string;
  /** Coluna de destino, quando o card muda de coluna. */
  readonly laneId?: string;
}

/** Avisa e devolve `true` quando a coluna do card, ou a de destino, está bloqueada. */
export type LockWarning = (change: LockCheck) => boolean;

export interface LockWarningParams {
  readonly lanes: readonly BoardLane[];
  readonly notify: Notify;
}

export function lockWarning(params: LockWarningParams): LockWarning {
  return (change) => {
    const locked = lockedLaneOf({ lanes: params.lanes, ...change });
    if (!locked) {
      return false;
    }
    params.notify({
      color: 'warning',
      text: `A coluna ${locked.title} está bloqueada: libere a coluna para mudar os cards dela.`,
    });
    return true;
  };
}
