import { readFileSync, writeFileSync } from 'node:fs';

import { allCards } from './board';
import { boardOfDocument } from './board-document';
import {
  applyChanges,
  sampleBoard,
  sampleBoardDocument,
} from './board-document-sample';
import { archivedCards, createBoard } from './board-state';
import { contractProjectFile } from './contract-project-file';
import { refusedChange } from './process-run';
import { cardOf, runOf } from './process-test-data';
import { BOARD_RULES } from './rules';

// NOTE: a amostra fica no projeto do contrato, que a valida contra os schemas do `openapi.yaml`.
const SAMPLE_FILE = contractProjectFile('samples/board-document.json');

const HOW_TO_UPDATE = [
  'A amostra apps/backoffice-mock/samples/board-document.json não é mais o que o painel grava.',
  'Se a mudança de formato é de propósito, regrave a amostra, formate-a e confira o contrato:',
  "  UPDATE_SAMPLES=1 pnpm nx test backoffice --skip-nx-cache -- 'src/app/(painel)/quadro/model/board-document-sample.spec.ts'",
  '  pnpm exec biome format --write apps/backoffice-mock/samples/board-document.json',
  '  pnpm nx run backoffice-mock:test',
  'Se o contrato recusar a amostra nova, o que muda é o apps/backoffice-mock/openapi.yaml, não a amostra.',
].join('\n');

/** O documento como ele viaja: sem os campos ausentes. */
function throughJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readSample(): unknown {
  try {
    return JSON.parse(readFileSync(SAMPLE_FILE, 'utf8'));
  } catch {
    // NOTE: sem o arquivo, ou com ele estragado, a comparação falha com a instrução de como regravar.
    return undefined;
  }
}

describe('applyChanges', () => {
  const start = createBoard({ lanes: [{ id: 'a', title: 'A', cards: [] }] });

  it('interrompe na mudança que o quadro recusa', () => {
    const changes = [{ minute: 7, update: () => refusedChange('Recusada.') }];

    expect(() => applyChanges({ start, changes })).toThrow(
      'Minuto 7: Recusada.',
    );
  });

  it('interrompe na mudança que não muda nada', () => {
    const changes = [{ minute: 3, update: () => start }];

    expect(() => applyChanges({ start, changes })).toThrow(
      'Minuto 3: a mudança não valeu.',
    );
  });
});

describe('amostra do documento do quadro', () => {
  const board = sampleBoard();

  it('tem o que o painel grava num quadro em uso', () => {
    const owner = cardOf({ board, cardId: 'item-1' });
    const run = runOf(owner);
    const child = cardOf({ board, cardId: 'card-6' });
    const blocked = cardOf({ board, cardId: 'item-4' });
    const kinds = new Set(
      [...allCards(board.lanes), ...archivedCards(board)].flatMap((card) =>
        (card.activity ?? []).map((entry) => entry.kind),
      ),
    );

    expect(run.status).toBe('running');
    expect(run.log.some((event) => event.values !== undefined)).toBe(true);
    expect(child.stepOf).toEqual({
      cardId: 'item-1',
      tokenId: run.tokens.find((token) => token.delegateId === 'card-6')?.id,
    });
    expect(blocked.blockedBy).toEqual(['card-5']);
    expect(blocked.attachments?.map((item) => item.name)).toEqual([
      'nota.txt',
      'Guia',
    ]);
    expect(blocked.labelIds).toEqual(['label-1', 'label-3']);
    expect(blocked.comments).toHaveLength(1);
    expect(owner.assigneeId).toBe('person-1');
    expect(cardOf({ board, cardId: 'card-7' }).parentId).toBe('item-1');
    expect(archivedCards(board).map((card) => card.id)).toEqual(['item-3']);
    expect(board.processes).toHaveLength(1);
    expect(Object.keys(board.config.rules ?? {})).toEqual([...BOARD_RULES]);
    expect([...kinds]).toEqual(
      expect.arrayContaining([
        'process-started',
        'process-step',
        'blocker-added',
        'checklist-converted',
        'from-checklist',
        'attachment',
        'labels',
        'assignee',
        'archived',
      ]),
    );
  });

  it('é relida pelo painel sem perda', () => {
    const document = throughJson(sampleBoardDocument());

    expect(throughJson(boardOfDocument(document))).toEqual(document.board);
  });

  it('é a que está gravada no projeto do contrato', () => {
    const document = throughJson(sampleBoardDocument());
    if (process.env.UPDATE_SAMPLES === '1') {
      writeFileSync(SAMPLE_FILE, `${JSON.stringify(document, null, 2)}\n`);
    }

    expect(readSample(), HOW_TO_UPDATE).toEqual(document);
  });
});
