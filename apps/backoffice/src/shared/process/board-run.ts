import type { ProcessPlan } from './plan';
import { parsePlan } from './plan-parse';
import { type ProcessRun, parseRun } from './run';
import { BOARD_HREF } from './run-view-store';
import {
  isFilledText,
  isPositiveInteger,
  isRecord,
  type UnknownRecord,
} from './stored-values';

// NOTE: os parâmetros do endereço do quadro (`?quadro=<id do quadro>&card=<código do card>`) são repetidos aqui porque
// esta pasta não importa nada do quadro; quem define os dois é a página do quadro.
const BOARD_PARAM = 'quadro';
const CARD_PARAM = 'card';

/** Endereço do quadro `boardId`. */
export function boardHref(boardId: string): string {
  const query = new URLSearchParams({ [BOARD_PARAM]: boardId });
  return `${BOARD_HREF}?${query.toString()}`;
}

export interface BoardCardParams {
  readonly boardId: string;
  /** O conteúdo do documento do quadro (`board`), como veio da API, ainda sem formato garantido. */
  readonly board: unknown;
  readonly cardId: string;
}

/** O que a página do diagrama usa de um card do quadro. */
export interface BoardCardRun {
  /** Como o card aparece para o usuário: o código e o título dele. */
  readonly cardLabel: string;
  /** Endereço do card no quadro. */
  readonly backHref: string;
  /** Execução do processo do card; `undefined` quando ele não segue processo ou a execução gravada é ilegível. */
  readonly run: ProcessRun | undefined;
}

function listOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Os cards das colunas do quadro, na ordem da tela. */
function laneCardsOf(board: UnknownRecord): readonly unknown[] {
  const cards: unknown[] = [];
  for (const lane of listOf(board.lanes)) {
    if (isRecord(lane)) {
      cards.push(...listOf(lane.cards));
    }
  }
  return cards;
}

/** Todos os cards do quadro: os das colunas e os arquivados, que o quadro ainda abre para leitura. */
function cardsOf(board: UnknownRecord): readonly unknown[] {
  const cards: unknown[] = [...laneCardsOf(board)];
  for (const entry of listOf(board.archive)) {
    if (!isRecord(entry)) {
      continue;
    }
    for (const archived of listOf(entry.cards)) {
      if (isRecord(archived)) {
        cards.push(archived.card);
      }
    }
  }
  return cards;
}

interface CardKeyParams {
  readonly board: UnknownRecord;
  readonly card: UnknownRecord;
}

/** Código do card (`QD-12`): o prefixo do quadro e o número do card; `undefined` quando falta um dos dois. */
function cardKey(params: CardKeyParams): string | undefined {
  const { config } = params.board;
  const { number } = params.card;
  if (
    !isRecord(config) ||
    !isFilledText(config.keyPrefix) ||
    !isPositiveInteger(number)
  ) {
    return undefined;
  }
  return `${config.keyPrefix}-${number}`;
}

interface CardLabelParams {
  readonly key: string | undefined;
  readonly title: string | undefined;
}

function cardLabel(params: CardLabelParams): string {
  const { key, title } = params;
  if (key !== undefined && title !== undefined) {
    return `${key} ${title}`;
  }
  return key ?? title ?? 'Card sem título';
}

/**
 * Lê do documento do quadro o card pedido, só com o que o diagrama precisa: como chamar o card, como voltar a ele e
 * a execução do processo dele. A leitura é tolerante: o que não é do diagrama não é conferido, e o que falta do card
 * não o invalida. `null` quando o documento não tem o card.
 */
export function readBoardCard(params: BoardCardParams): BoardCardRun | null {
  const { boardId, board, cardId } = params;
  if (!isRecord(board)) {
    return null;
  }
  const card = cardsOf(board).find(
    (item) => isRecord(item) && item.id === cardId,
  );
  if (!isRecord(card)) {
    return null;
  }
  const { label, href } = describeCard({ boardId, board, card });
  return { cardLabel: label, backHref: href, run: parseRun(card.process) };
}

interface DescribeCardParams extends CardKeyParams {
  readonly boardId: string;
}

interface CardDescription {
  /** Como o card aparece para o usuário: o código e o título dele. */
  readonly label: string;
  /** Endereço do card no quadro; sem o código do card, o do quadro. */
  readonly href: string;
}

function describeCard(params: DescribeCardParams): CardDescription {
  const { boardId, board, card } = params;
  const key = cardKey({ board, card });
  const title = isFilledText(card.title) ? card.title : undefined;
  const query = new URLSearchParams({ [BOARD_PARAM]: boardId });
  if (key !== undefined) {
    query.set(CARD_PARAM, key);
  }
  return {
    label: cardLabel({ key, title }),
    href: `${BOARD_HREF}?${query.toString()}`,
  };
}

type PlanRef = Pick<ProcessRun, 'definitionId' | 'version'>;

function planKey(ref: PlanRef): string {
  return `${ref.definitionId}:${ref.version}`;
}

/** Roteiros que o quadro guarda, um por versão de processo: o primeiro de cada versão fica, e o ilegível sai. */
function plansOf(board: UnknownRecord): ReadonlyMap<string, ProcessPlan> {
  const plans = new Map<string, ProcessPlan>();
  for (const item of listOf(board.processes)) {
    if (
      !isRecord(item) ||
      !isFilledText(item.definitionId) ||
      !isPositiveInteger(item.version)
    ) {
      continue;
    }
    const key = planKey({
      definitionId: item.definitionId,
      version: item.version,
    });
    const plan = parsePlan(item.plan);
    if (plan !== null && !plans.has(key)) {
      plans.set(key, plan);
    }
  }
  return plans;
}

export interface BoardContentParams {
  readonly boardId: string;
  /** O conteúdo do quadro (`board`), como veio da API ou do navegador, ainda sem formato garantido. */
  readonly board: unknown;
}

/** Card das colunas com processo em andamento. */
export interface RunningCard {
  readonly cardId: string;
  /** Como o card aparece para o usuário: o código e o título dele. */
  readonly cardLabel: string;
  /** Endereço do card no quadro. */
  readonly cardHref: string;
  readonly run: ProcessRun;
  /** Roteiro da versão em que a execução começou, como o quadro o guarda. */
  readonly plan: ProcessPlan;
}

/**
 * Lê do conteúdo do quadro os cards das colunas com processo em andamento, na ordem da tela. A leitura é tolerante,
 * como a de `readBoardCard`: o card sem id, com a execução ilegível ou encerrada, ou sem o roteiro dela no quadro,
 * fica de fora sem derrubar os outros. Os arquivados não entram, porque o quadro não deixa agir neles.
 */
export function readRunningCards(
  params: BoardContentParams,
): readonly RunningCard[] {
  const { boardId, board } = params;
  if (!isRecord(board)) {
    return [];
  }
  const plans = plansOf(board);
  const running: RunningCard[] = [];
  for (const card of laneCardsOf(board)) {
    if (!isRecord(card) || !isFilledText(card.id)) {
      continue;
    }
    const run = parseRun(card.process);
    if (run === undefined || run.status !== 'running') {
      continue;
    }
    const plan = plans.get(planKey(run));
    if (plan === undefined) {
      continue;
    }
    const { label, href } = describeCard({ boardId, board, card });
    running.push({
      cardId: card.id,
      cardLabel: label,
      cardHref: href,
      run,
      plan,
    });
  }
  return running;
}
