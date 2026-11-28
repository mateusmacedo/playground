import { readFileSync } from 'node:fs';

import type { BoardDocument } from '@/shared/api/contract';

import { boardOfDocument, toBoardDocument } from './board-document';
import { createBoard } from './board-state';
import { contractProjectFile } from './contract-project-file';
import { sampleLabels, sampleLanes } from './sample-board';
import { BOARD_VERSION } from './storage';

// NOTE: os dados iniciais do mock ficam no projeto do contrato; o painel os lê daqui para provar que os entende.
const SEED_FILE = contractProjectFile('seed/boards.json');

/** O documento como ele viaja: sem os campos ausentes e sem dividir objeto com o quadro da tela. */
function throughJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('toBoardDocument', () => {
  it('monta o documento com o quadro no formato gravado e a versão do formato', () => {
    const board = createBoard({ lanes: sampleLanes, labels: sampleLabels });

    const document = toBoardDocument({ id: 'board-1', name: 'Vendas', board });

    expect(document).toEqual({
      id: 'board-1',
      name: 'Vendas',
      schemaVersion: BOARD_VERSION,
      board,
    });
  });
});

describe('boardOfDocument', () => {
  it('relê o quadro que o próprio painel gravou, sem perda', () => {
    const board = createBoard({ lanes: sampleLanes, labels: sampleLabels });
    const document = throughJson(
      toBoardDocument({ id: 'board-1', name: 'Vendas', board }),
    );

    expect(boardOfDocument(document)).toEqual(throughJson(board));
  });

  it('recusa a versão de formato que não conhece', () => {
    const board = createBoard({ lanes: sampleLanes });

    expect(boardOfDocument({ schemaVersion: 99, board })).toBeNull();
  });

  it('recusa o conteúdo que não forma um quadro', () => {
    expect(
      boardOfDocument({ schemaVersion: BOARD_VERSION, board: { lanes: 'x' } }),
    ).toBeNull();
    expect(
      boardOfDocument({ schemaVersion: BOARD_VERSION, board: undefined }),
    ).toBeNull();
  });
});

describe('dados iniciais do mock da API', () => {
  const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as BoardDocument[];

  it('traz ao menos um quadro', () => {
    expect(seed.length).toBeGreaterThan(0);
  });

  it.each(seed.map((document) => [document.id, document] as const))(
    'o painel lê o quadro %s sem perda',
    (_id, document) => {
      const board = boardOfDocument(document);
      if (board === null) {
        throw new Error(`O painel não leu o quadro ${document.id}.`);
      }

      const { id, name } = document;
      const written = throughJson(toBoardDocument({ id, name, board }));

      expect({ ...written, revision: document.revision }).toEqual(document);
    },
  );
});
