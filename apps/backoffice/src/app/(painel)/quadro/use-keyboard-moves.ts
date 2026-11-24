import type { BoardCommands } from './board-commands';
import type { Announce } from './board-notices';
import { announcementText, laneAnnouncementText } from './model/announcements';
import type { BoardLane } from './model/board';
import { type StepDirection, stepCard } from './model/card-moves';
import { mergeVisible, respectsLocks } from './model/lane-state';
import { type LaneDirection, stepLane } from './model/lanes';
import type { CollapsedLanes } from './use-collapsed-lanes';
import {
  CARD_STEP_KEYS,
  type KeyboardMove,
  LANE_STEP_KEYS,
  type MoveEvent,
  type MoveStep,
  useKeyboardMove,
} from './use-keyboard-move';

/** Passos do teclado entram no mesmo passo do desfazer até o item ser solto. */
const KEYBOARD_MOVE = 'keyboard';

/** Passo do card pelo teclado; o passo que mexe numa coluna bloqueada não acontece. */
function stepCardById(move: MoveStep<StepDirection>): readonly BoardLane[] {
  const next = stepCard({
    lanes: move.lanes,
    cardId: move.id,
    direction: move.direction,
  });
  return respectsLocks({ before: move.lanes, after: next }) ? next : move.lanes;
}

function stepLaneById(move: MoveStep<LaneDirection>): readonly BoardLane[] {
  return stepLane({
    lanes: move.lanes,
    laneId: move.id,
    direction: move.direction,
  });
}

function cardMoveAnnouncement(event: MoveEvent): string {
  return announcementText({
    kind: event.kind,
    lanes: event.lanes,
    cardId: event.id,
  });
}

function laneMoveAnnouncement(event: MoveEvent): string {
  return laneAnnouncementText({
    kind: event.kind,
    lanes: event.lanes,
    laneId: event.id,
  });
}

interface LanesReceivingParams {
  readonly before: readonly BoardLane[];
  readonly after: readonly BoardLane[];
  readonly collapsed: ReadonlySet<string>;
}

/** Colunas recolhidas que vão receber um card que ainda não está nelas. */
function lanesReceiving(params: LanesReceivingParams): readonly string[] {
  const receiving: string[] = [];
  for (const lane of params.after) {
    if (!params.collapsed.has(lane.id)) {
      continue;
    }
    const previous = params.before.find((item) => item.id === lane.id);
    const previousIds = new Set(previous?.cards.map((card) => card.id));
    if (lane.cards.some((card) => !previousIds.has(card.id))) {
      receiving.push(lane.id);
    }
  }
  return receiving;
}

/** Alça clicada: o movimento a que ela pertence (de card ou de coluna) e o item dela. */
interface HandleClick {
  readonly move: KeyboardMove;
  readonly id: string;
}

export interface UseKeyboardMovesParams {
  /** Todas as colunas do quadro, inclusive as ocultas. */
  readonly lanes: readonly BoardLane[];
  /** As colunas que estão na tela. */
  readonly shown: readonly BoardLane[];
  readonly collapsedLanes: CollapsedLanes;
  readonly commands: Pick<BoardCommands, 'setLanes' | 'seal'>;
  readonly announce: Announce;
}

export interface KeyboardMoves {
  readonly card: KeyboardMove;
  readonly lane: KeyboardMove;
  /** Solta o card e a coluna pegos, quando o arraste ou o desfazer assume. */
  readonly release: () => void;
  readonly onCardHandleClick: (cardId: string) => void;
  readonly onLaneHandleClick: (laneId: string) => void;
}

/** Movimento de cards e de colunas pelo teclado, gravado no quadro com as colunas ocultas nos lugares delas. */
export function useKeyboardMoves(
  params: UseKeyboardMovesParams,
): KeyboardMoves {
  const { lanes, shown, collapsedLanes, commands, announce } = params;

  function saveStep(next: readonly BoardLane[]) {
    commands.setLanes({
      lanes: mergeVisible({ all: lanes, visible: next }),
      key: KEYBOARD_MOVE,
    });
  }

  const card = useKeyboardMove({
    lanes: shown,
    setLanes: (next) => {
      // WHY: o card levado pelo teclado para uma coluna recolhida precisa da alça na tela para continuar com o foco.
      const receiving = lanesReceiving({
        before: shown,
        after: next,
        collapsed: collapsedLanes.collapsed,
      });
      if (receiving.length > 0) {
        collapsedLanes.expand(receiving);
      }
      saveStep(next);
    },
    announce,
    keys: CARD_STEP_KEYS,
    step: stepCardById,
    announcementFor: cardMoveAnnouncement,
  });
  const lane = useKeyboardMove({
    lanes: shown,
    setLanes: saveStep,
    announce,
    keys: LANE_STEP_KEYS,
    step: stepLaneById,
    announcementFor: laneMoveAnnouncement,
  });

  function clickHandle(click: HandleClick) {
    // NOTE: pegar um item abre um passo novo no desfazer; os passos das setas entram nele até soltar.
    if (click.move.grabbedId !== click.id) {
      commands.seal();
    }
    click.move.onHandleClick(click.id);
  }

  return {
    card,
    lane,
    release: () => {
      card.release();
      lane.release();
    },
    onCardHandleClick: (cardId) => clickHandle({ move: card, id: cardId }),
    onLaneHandleClick: (laneId) => clickHandle({ move: lane, id: laneId }),
  };
}
