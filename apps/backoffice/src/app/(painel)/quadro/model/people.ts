import type {
  ArchiveEntry,
  Board,
  BoardCard,
  BoardLane,
  BoardPerson,
} from './board';
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

/** O responsável do card saiu da lista de pessoas. */
function hasUnknownAssignee(params: AssigneeCheck): boolean {
  const { card, known } = params;
  if (!card.assigneeId) {
    return false;
  }
  return !known.has(card.assigneeId);
}

/** Tira do card o responsável que não está mais na lista. */
function withKnownAssignee(params: AssigneeCheck): BoardCard {
  if (!hasUnknownAssignee(params)) {
    return params.card;
  }
  return { ...params.card, assigneeId: undefined };
}

/** Coluna a conferir contra os ids das pessoas que continuam no quadro. */
interface LaneAssigneesCheck {
  readonly lane: BoardLane;
  readonly known: ReadonlySet<string>;
}

/** A coluna sem os responsáveis que saíram; sem nenhum deles, a própria coluna. */
function laneWithKnownAssignees(params: LaneAssigneesCheck): BoardLane {
  const { lane, known } = params;
  const hasUnknown = lane.cards.some((card) =>
    hasUnknownAssignee({ card, known }),
  );
  if (!hasUnknown) {
    return lane;
  }
  const cards = lane.cards.map((card) => withKnownAssignee({ card, known }));
  return { ...lane, cards };
}

/** Arquivamento a conferir contra os ids das pessoas que continuam no quadro. */
interface EntryAssigneesCheck {
  readonly entry: ArchiveEntry;
  readonly known: ReadonlySet<string>;
}

function entryWithKnownAssignees(params: EntryAssigneesCheck): ArchiveEntry {
  const { entry, known } = params;
  const cards = entry.cards.map((item) => ({
    ...item,
    card: withKnownAssignee({ card: item.card, known }),
  }));
  return { ...entry, cards };
}

export interface SetPeopleParams {
  readonly board: Board;
  readonly people: readonly BoardPerson[];
}

/** Troca as pessoas do quadro; os cards de quem saiu ficam sem responsável, inclusive os arquivados. */
export function setPeople(params: SetPeopleParams): Board {
  const { board, people } = params;
  const known = new Set(people.map((person) => person.id));
  const lanes = board.lanes.map((lane) =>
    laneWithKnownAssignees({ lane, known }),
  );
  const archive = board.archive.map((entry) =>
    entryWithKnownAssignees({ entry, known }),
  );
  const config = {
    ...board.config,
    people: people.length > 0 ? people : undefined,
  };
  return { ...board, config, lanes, archive };
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
  const first = words[0] ?? '';
  if (words.length < 2) {
    return first.slice(0, 2).toUpperCase();
  }
  const last = words.at(-1) ?? '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
