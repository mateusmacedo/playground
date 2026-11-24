import { withActivity } from './activity';
import { activityText } from './activity-text';
import {
  addAttachment,
  formatBytes,
  isStoredFile,
  isWebLink,
  MAX_ATTACHMENT_BYTES,
  removeAttachment,
} from './attachments';
import type { Board, BoardLane } from './board';
import { configureBoard } from './board-settings';
import { createBoard } from './board-state';
import { addComment, MAX_COMMENT_LENGTH, removeComment } from './comments';
import { childProgress, progressText } from './completion';
import {
  addPerson,
  initials,
  personName,
  setAssignee,
  setPeople,
  validPersonName,
} from './people';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'p', title: 'Pai' },
      { id: 'a', title: 'A', parentId: 'p' },
    ],
  },
  {
    id: 'done',
    title: 'Feito',
    cards: [
      { id: 'b', title: 'B', parentId: 'p' },
      { id: 'c', title: 'C', parentId: 'a' },
    ],
  },
];

const people = [
  { id: 'person-1', name: 'Ana Souza' },
  { id: 'person-2', name: 'Bruno' },
];

const board: Board = createBoard({
  lanes,
  config: { keyPrefix: 'QD', people },
});

function cardOf(target: Board | readonly BoardLane[], cardId: string) {
  const all = 'lanes' in target ? target.lanes : target;
  return all.flatMap((lane) => lane.cards).find((card) => card.id === cardId);
}

describe('progresso dos filhos', () => {
  it('conta os filhos diretos que estão na coluna de conclusão', () => {
    const progress = childProgress({ lanes, doneLaneId: 'done' });
    expect(progress.get('p')).toEqual({ done: 1, total: 2 });
    expect(progress.get('a')).toEqual({ done: 1, total: 1 });
    expect(progress.has('b')).toBe(false);
    expect(childProgress({ lanes, doneLaneId: undefined }).size).toBe(0);
    expect(childProgress({ lanes, doneLaneId: 'sumiu' }).size).toBe(0);
    expect(progressText({ done: 1, total: 2 })).toBe(
      '1 de 2 filhos concluídos',
    );
    expect(progressText({ done: 1, total: 1 })).toBe('1 de 1 filho concluído');
  });
});

describe('pessoas e responsável', () => {
  it('acrescenta pessoas sem repetir o nome', () => {
    const added = addPerson({ people, name: ' Carla ' });
    expect(added.at(-1)).toEqual({ id: 'person-3', name: 'Carla' });
    expect(addPerson({ people, name: 'bruno' })).toBe(people);
    expect(addPerson({ people, name: '  ' })).toBe(people);
    expect(validPersonName({ people, name: 'Ána souza' })).toBeNull();
  });

  it('define o responsável só com pessoa do quadro', () => {
    const assigned = setAssignee({
      board,
      cardId: 'a',
      assigneeId: 'person-1',
    });
    expect(cardOf(assigned, 'a')?.assigneeId).toBe('person-1');
    expect(
      setAssignee({ board: assigned, cardId: 'a', assigneeId: 'person-1' }),
    ).toBe(assigned);
    expect(setAssignee({ board, cardId: 'a', assigneeId: 'ninguém' })).toBe(
      board,
    );
    expect(
      cardOf(
        setAssignee({ board: assigned, cardId: 'a', assigneeId: undefined }),
        'a',
      )?.assigneeId,
    ).toBeUndefined();
    expect(personName({ board, personId: 'person-2' })).toBe('Bruno');
    expect(personName({ board, personId: undefined })).toBeUndefined();
  });

  it('tira o responsável de quem sai do quadro, inclusive nos arquivados', () => {
    const assigned = setAssignee({
      board,
      cardId: 'a',
      assigneeId: 'person-1',
    });
    const withArchive: Board = {
      ...assigned,
      archive: [
        {
          id: 'x',
          archivedAt: '2026-01-01T00:00:00.000Z',
          cards: [
            {
              laneId: 'todo',
              card: { id: 'x', title: 'X', number: 9, assigneeId: 'person-1' },
            },
          ],
        },
      ],
    };
    const next = setPeople({
      board: withArchive,
      people: [{ id: 'person-2', name: 'Bruno' }],
    });
    expect(cardOf(next, 'a')?.assigneeId).toBeUndefined();
    expect(next.archive[0]?.cards[0]?.card.assigneeId).toBeUndefined();
    expect(setPeople({ board, people: [] }).config.people).toBeUndefined();
  });

  it('tira as iniciais do nome', () => {
    expect(initials('Ana Souza')).toBe('AS');
    expect(initials('bruno')).toBe('BR');
    expect(initials('Ana Maria Souza')).toBe('AS');
  });
});

describe('comentários', () => {
  it('acrescenta e tira comentários do card', () => {
    const at = '2026-01-01T10:00:00.000Z';
    const withOne = addComment({
      lanes,
      cardId: 'a',
      comment: { at, author: 'Ana', text: '  Pronto  ' },
    });
    expect(cardOf(withOne, 'a')?.comments).toEqual([
      { id: 'comment-1', at, author: 'Ana', text: 'Pronto' },
    ]);
    expect(
      addComment({
        lanes,
        cardId: 'a',
        comment: { at, author: 'A', text: ' ' },
      }),
    ).toBe(lanes);
    const long = addComment({
      lanes,
      cardId: 'a',
      comment: { at, author: 'A', text: 'x'.repeat(MAX_COMMENT_LENGTH + 5) },
    });
    expect(cardOf(long, 'a')?.comments?.[0]?.text).toHaveLength(
      MAX_COMMENT_LENGTH,
    );

    const removed = removeComment({
      lanes: withOne,
      cardId: 'a',
      commentId: 'comment-1',
    });
    expect(cardOf(removed, 'a')?.comments).toBeUndefined();
    expect(
      removeComment({ lanes: withOne, cardId: 'a', commentId: 'nenhum' }),
    ).toBe(withOne);
  });
});

describe('anexos', () => {
  const at = '2026-01-01T10:00:00.000Z';

  it('aceita link web e arquivo pequeno, e recusa o resto', () => {
    expect(isWebLink('https://exemplo.com/a')).toBe(true);
    expect(isWebLink('javascript:alert(1)')).toBe(false);
    expect(isWebLink('nada')).toBe(false);

    const link = addAttachment({
      lanes,
      cardId: 'a',
      attachment: { name: ' Doc ', url: ' https://exemplo.com ', at },
    });
    expect(cardOf(link, 'a')?.attachments).toEqual([
      { id: 'attachment-1', name: 'Doc', url: 'https://exemplo.com', at },
    ]);
    const file = addAttachment({
      lanes,
      cardId: 'a',
      attachment: { name: 'a.txt', url: 'data:text/plain,oi', size: 2, at },
    });
    const stored = cardOf(file, 'a')?.attachments?.[0];
    expect(stored && isStoredFile(stored)).toBe(true);

    expect(
      addAttachment({
        lanes,
        cardId: 'a',
        attachment: { name: 'x', url: 'javascript:alert(1)', at },
      }),
    ).toBe(lanes);
    expect(
      addAttachment({
        lanes,
        cardId: 'a',
        attachment: {
          name: 'grande',
          url: 'data:text/plain,x',
          size: MAX_ATTACHMENT_BYTES + 1,
          at,
        },
      }),
    ).toBe(lanes);
    expect(
      addAttachment({
        lanes,
        cardId: 'a',
        attachment: { name: ' ', url: 'https://exemplo.com', at },
      }),
    ).toBe(lanes);

    const removed = removeAttachment({
      lanes: link,
      cardId: 'a',
      attachmentId: 'attachment-1',
    });
    expect(cardOf(removed, 'a')?.attachments).toBeUndefined();
    expect(
      removeAttachment({ lanes: link, cardId: 'a', attachmentId: 'nenhum' }),
    ).toBe(link);
  });

  it('formata o tamanho do arquivo', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB');
  });
});

describe('configuração num passo só', () => {
  it('aplica prefixo, coluna de conclusão e pessoas juntos', () => {
    const next = configureBoard({
      board,
      keyPrefix: 'ops',
      doneLaneId: 'done',
      people: [...people, { id: 'person-3', name: 'Carla' }],
    });
    expect(next.config.keyPrefix).toBe('OPS');
    expect(next.config.doneLaneId).toBe('done');
    expect(next.config.people).toHaveLength(3);

    expect(
      configureBoard({ board: next, doneLaneId: null }).config.doneLaneId,
    ).toBeUndefined();
    expect(configureBoard({ board, doneLaneId: 'sumiu' })).toBe(board);
    expect(
      configureBoard({ board, keyPrefix: 'QD', doneLaneId: null, people }),
    ).toBe(board);
  });
});

describe('histórico de responsável e anexos', () => {
  it('registra a troca de responsável e o anexo que entrou ou saiu', () => {
    const at = '2026-01-01T10:00:00.000Z';
    const assigned = setAssignee({
      board,
      cardId: 'a',
      assigneeId: 'person-2',
    });
    const logged = withActivity({
      before: board,
      after: assigned,
      at,
      merge: false,
    });
    const entries = cardOf(logged, 'a')?.activity ?? [];
    expect(entries.map(activityText)).toEqual(['Responsável: Bruno.']);

    const unassigned = setAssignee({
      board: logged,
      cardId: 'a',
      assigneeId: undefined,
    });
    expect(
      (
        cardOf(
          withActivity({ before: logged, after: unassigned, at, merge: false }),
          'a',
        )?.activity ?? []
      ).map(activityText),
    ).toContain('Responsável retirado.');

    const attached: Board = {
      ...board,
      lanes: addAttachment({
        lanes: board.lanes,
        cardId: 'a',
        attachment: { name: 'Doc', url: 'https://exemplo.com', at },
      }),
    };
    const withAttachment = withActivity({
      before: board,
      after: attached,
      at,
      merge: false,
    });
    expect(
      (cardOf(withAttachment, 'a')?.activity ?? []).map(activityText),
    ).toEqual(['Anexo Doc adicionado.']);
    const detached: Board = {
      ...withAttachment,
      lanes: removeAttachment({
        lanes: withAttachment.lanes,
        cardId: 'a',
        attachmentId: 'attachment-1',
      }),
    };
    expect(
      (
        cardOf(
          withActivity({
            before: withAttachment,
            after: detached,
            at,
            merge: false,
          }),
          'a',
        )?.activity ?? []
      ).map(activityText),
    ).toContain('Anexo Doc removido.');
  });
});
