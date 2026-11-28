import type { BoardDocument } from '@/shared/api/contract';
import { tokenAt } from '@/shared/process/engine-test-kit';

import { archiveCard } from './archive';
import { addAttachment } from './attachments';
import type { Board } from './board';
import { applyChange } from './board-change';
import { toBoardDocument } from './board-document';
import { sampleProcess } from './board-document-sample-process';
import { configureBoard } from './board-settings';
import { createBoard } from './board-state';
import { addCard } from './cards';
import { convertChecklistItem } from './checklist-convert';
import { addComment } from './comments';
import { addBlocker } from './dependencies';
import { startHistory } from './history';
import { toggleCardLabel } from './labels';
import { setAssignee } from './people';
import {
  advanceProcess,
  type ProcessChange,
  startProcess,
} from './process-run';
import { cardOf, runOf } from './process-test-data';
import { BOARD_RULES } from './rules';
import { sampleLabels, sampleLanes } from './sample-board';
import { delegateStep } from './step-delegation';

interface ChangeContext {
  readonly board: Board;
  /** Instante da mudança, ISO 8601. */
  readonly at: string;
}

export interface SampleChange {
  /** Minuto da mudança dentro da hora da amostra, para a ordem do histórico ser sempre a mesma. */
  readonly minute: number;
  readonly update: (context: ChangeContext) => Board | ProcessChange;
}

function timeAt(minute: number): string {
  return `2026-11-26T12:${String(minute).padStart(2, '0')}:00.000Z`;
}

interface TokenIdParams {
  readonly board: Board;
  readonly stepRef: string;
}

/** Ficha do card `item-1` parada na etapa. */
function tokenId(params: TokenIdParams): string {
  const run = runOf(cardOf({ board: params.board, cardId: 'item-1' }));
  return tokenAt({ run, stepRef: params.stepRef }).id;
}

const changes: readonly SampleChange[] = [
  {
    minute: 1,
    update: ({ board }) => {
      const rules = Object.fromEntries(BOARD_RULES.map((rule) => [rule, true]));
      return configureBoard({
        board,
        doneLaneId: 'done',
        people: [
          { id: 'person-1', name: 'Ana' },
          { id: 'person-2', name: 'Bruno' },
        ],
        rules,
      });
    },
  },
  {
    minute: 2,
    update: ({ board }) =>
      setAssignee({ board, cardId: 'item-1', assigneeId: 'person-1' }),
  },
  {
    minute: 3,
    update: ({ board }) => ({
      ...board,
      lanes: addCard({
        lanes: board.lanes,
        laneId: 'todo',
        card: { id: 'card-5', title: 'Preparar o contrato', number: 5 },
      }),
      nextNumber: 6,
    }),
  },
  {
    minute: 4,
    update: ({ board, at }) =>
      startProcess({
        board,
        cardId: 'item-1',
        process: sampleProcess,
        at,
        by: 'Ana',
      }),
  },
  {
    minute: 5,
    update: ({ board, at }) =>
      advanceProcess({
        board,
        cardId: 'item-1',
        at,
        by: 'Ana',
        action: {
          kind: 'complete',
          tokenId: tokenId({ board, stepRef: 'triage' }),
          note: 'Pedido completo.',
          values: {
            summary: 'Troca de titularidade',
            amount: '1250',
            received: '2026-11-25',
            priority: 'Alta',
            complete: true,
          },
        },
      }),
  },
  {
    minute: 6,
    update: ({ board, at }) =>
      delegateStep({
        board,
        cardId: 'item-1',
        tokenId: tokenId({ board, stepRef: 'analysis' }),
        newId: 'card-6',
        at,
        by: 'Ana',
      }),
  },
  {
    minute: 7,
    update: ({ board }) =>
      addBlocker({ board, cardId: 'item-4', blockerId: 'card-5' }),
  },
  {
    minute: 8,
    update: ({ board, at }) => ({
      ...board,
      lanes: addAttachment({
        lanes: board.lanes,
        cardId: 'item-4',
        attachment: {
          name: 'nota.txt',
          url: 'data:text/plain;base64,T2zDoQ==',
          at,
          size: 4,
        },
      }),
    }),
  },
  {
    minute: 9,
    update: ({ board, at }) => ({
      ...board,
      lanes: addAttachment({
        lanes: board.lanes,
        cardId: 'item-4',
        attachment: { name: 'Guia', url: 'https://example.com/guia', at },
      }),
    }),
  },
  {
    minute: 10,
    update: ({ board }) => ({
      ...board,
      lanes: toggleCardLabel({
        lanes: board.lanes,
        cardId: 'item-4',
        labelId: 'label-3',
      }),
    }),
  },
  {
    minute: 11,
    update: ({ board, at }) => ({
      ...board,
      lanes: addComment({
        lanes: board.lanes,
        cardId: 'item-4',
        comment: { at, author: 'Bruno', text: 'Aguardando o contrato.' },
      }),
    }),
  },
  {
    minute: 12,
    update: ({ board, at }) =>
      convertChecklistItem({
        board,
        cardId: 'item-1',
        itemId: 'item-2',
        newId: 'card-7',
        at,
      }),
  },
  {
    minute: 13,
    update: ({ board, at }) => archiveCard({ board, cardId: 'item-3', at }),
  },
];

export interface ApplyChangesParams {
  readonly start: Board;
  readonly changes: readonly SampleChange[];
}

/**
 * Aplica as mudanças em ordem, como a tela faz: cada uma passa pelas regras do quadro e deixa o registro dela no
 * histórico dos cards. A mudança recusada, ou que não muda nada, interrompe com erro: a amostra não pode encolher em
 * silêncio.
 */
export function applyChanges(params: ApplyChangesParams): Board {
  let history = startHistory(params.start);
  for (const change of params.changes) {
    const at = timeAt(change.minute);
    const result = change.update({ board: history.present, at });
    if ('ok' in result && !result.ok) {
      throw new Error(`Minuto ${change.minute}: ${result.message}`);
    }
    const next = 'ok' in result ? result.board : result;
    const after = applyChange({ history, next, log: true, at });
    if (after === history) {
      throw new Error(`Minuto ${change.minute}: a mudança não valeu.`);
    }
    history = after;
  }
  return history.present;
}

/**
 * Quadro com um pouco de tudo o que o painel grava: processo em andamento com etapa resolvida, card filho de etapa,
 * dependência, anexos, comentário, etiquetas, pessoas, regras ligadas, item de checklist convertido e card arquivado.
 */
export function sampleBoard(): Board {
  const start = createBoard({ lanes: sampleLanes, labels: sampleLabels });
  return applyChanges({ start, changes });
}

/** O quadro de amostra como o documento que a API guarda. */
export function sampleBoardDocument(): BoardDocument {
  const content = toBoardDocument({
    id: 'board-sample',
    name: 'Quadro de amostra',
    board: sampleBoard(),
  });
  return { ...content, revision: 4 };
}
