import type { Board, BoardCard, BoardLane, BoardPerson } from './board';
import { updateCardIn } from './board';
import { nextId } from './ids';
import { normalizeText } from './search';

export interface ValidPersonNameParams {
  readonly people: readonly BoardPerson[];
  readonly name: string;
}

/** Nome sem espaços nas pontas; `null` quando vazio ou repetido (sem contar maiúsculas e acentos). */
export function validPersonName(params: ValidPersonNameParams): string | null {
  const name = params.name.trim();
  const taken = params.people.some(
    (person) => normalizeText(person.name) === normalizeText(name),
  );
  return name && !taken ? name : null;
}

export interface AddPersonParams {
  readonly people: readonly BoardPerson[];
  readonly name: string;
}

/** Acrescenta a pessoa ao fim da lista; nome vazio ou repetido não muda nada. */
export function addPerson(params: AddPersonParams): readonly BoardPerson[] {
  const name = validPersonName(params);
  if (!name) {
    return params.people;
  }
  const id = nextId({
    prefix: 'person',
    taken: params.people.map((person) => person.id),
  });
  return [...params.people, { id, name }];
}

/** Card a conferir contra os ids das pessoas que continuam no quadro. */
interface AssigneeCheck {
  readonly card: BoardCard;
  readonly known: ReadonlySet<string>;
}

/** Tira do card o responsável que não está mais na lista. */
function withKnownAssignee(params: AssigneeCheck): BoardCard {
  const { card, known } = params;
  return card.assigneeId && !known.has(card.assigneeId)
    ? { ...card, assigneeId: undefined }
    : card;
}

export interface SetPeopleParams {
  readonly board: Board;
  readonly people: readonly BoardPerson[];
}

/** Troca as pessoas do quadro; os cards de quem saiu ficam sem responsável, inclusive os arquivados. */
export function setPeople(params: SetPeopleParams): Board {
  const { board, people } = params;
  const known = new Set(people.map((person) => person.id));
  const clean = (lane: BoardLane): BoardLane =>
    lane.cards.some((card) => card.assigneeId && !known.has(card.assigneeId))
      ? {
          ...lane,
          cards: lane.cards.map((card) => withKnownAssignee({ card, known })),
        }
      : lane;
  return {
    ...board,
    config: { ...board.config, people: people.length > 0 ? people : undefined },
    lanes: board.lanes.map(clean),
    archive: board.archive.map((entry) => ({
      ...entry,
      cards: entry.cards.map((item) => ({
        ...item,
        card: withKnownAssignee({ card: item.card, known }),
      })),
    })),
  };
}

export interface SetAssigneeParams {
  readonly board: Board;
  readonly cardId: string;
  readonly assigneeId: string | undefined;
}

/** Define o responsável do card; `undefined` tira. Pessoa que não está no quadro não muda nada. */
export function setAssignee(params: SetAssigneeParams): Board {
  const { board, cardId, assigneeId } = params;
  if (
    assigneeId !== undefined &&
    !board.config.people?.some((person) => person.id === assigneeId)
  ) {
    return board;
  }
  const lanes = updateCardIn({
    lanes: board.lanes,
    cardId,
    update: (card) =>
      card.assigneeId === assigneeId ? card : { ...card, assigneeId },
  });
  return lanes === board.lanes ? board : { ...board, lanes };
}

export interface PersonNameParams {
  readonly board: Board;
  readonly personId: string | undefined;
}

export function personName(params: PersonNameParams): string | undefined {
  return params.board.config.people?.find(
    (person) => person.id === params.personId,
  )?.name;
}

/** Iniciais do nome, para o avatar do card. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`
      : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}
