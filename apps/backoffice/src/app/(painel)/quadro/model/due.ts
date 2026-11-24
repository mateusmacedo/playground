import { type BoardCard, type BoardLane, updateCardIn } from './board';

export type DueStatus = 'done' | 'overdue' | 'today' | 'upcoming';

/** Data no formato `AAAA-MM-DD` que existe no calendário. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export interface SetDueDateParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly dueDate: string | undefined;
}

/** Define o prazo do card; vazio tira o prazo e a marca de cumprido. Data inválida não muda nada. */
export function setDueDate(params: SetDueDateParams): readonly BoardLane[] {
  const dueDate = params.dueDate || undefined;
  if (dueDate !== undefined && !isDateOnly(dueDate)) {
    return params.lanes;
  }
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) => {
      if (card.dueDate === dueDate) {
        return card;
      }
      return dueDate
        ? { ...card, dueDate }
        : { ...card, dueDate: undefined, dueDone: undefined };
    },
  });
}

export interface SetDueDoneParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly done: boolean;
}

/** Marca o prazo como cumprido, ou não; card sem prazo não muda. */
export function setDueDone(params: SetDueDoneParams): readonly BoardLane[] {
  const { done } = params;
  return updateCardIn({
    lanes: params.lanes,
    cardId: params.cardId,
    update: (card) =>
      card.dueDate && Boolean(card.dueDone) !== done
        ? { ...card, dueDone: done || undefined }
        : card,
  });
}

/** Data de hoje no fuso de quem usa o painel, no formato `AAAA-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export interface DueStatusParams {
  readonly card: Pick<BoardCard, 'dueDate' | 'dueDone'>;
  readonly today: string;
}

/** Situação do prazo em relação a `today`; `undefined` para card sem prazo. */
export function dueStatus(params: DueStatusParams): DueStatus | undefined {
  const { card, today } = params;
  if (!card.dueDate) {
    return undefined;
  }
  if (card.dueDone) {
    return 'done';
  }
  if (card.dueDate < today) {
    return 'overdue';
  }
  return card.dueDate === today ? 'today' : 'upcoming';
}

// WHY: a data do prazo não tem hora; formatar em UTC evita que o fuso do navegador mostre o dia anterior.
const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `28 de nov.`, para o selo do card. */
export function formatShortDate(date: string): string {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

/** `28/11/2026`, para textos. */
export function formatFullDate(date: string): string {
  return fullDate.format(new Date(`${date}T00:00:00Z`));
}
