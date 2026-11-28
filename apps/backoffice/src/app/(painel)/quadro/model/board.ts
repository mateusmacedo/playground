import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import type { LinkActivity } from './link-activity';

/** Item do checklist de um card; o id só precisa ser único dentro do card. */
export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

/** Registro do processo do card no histórico dele. */
export type ProcessActivity =
  | {
      readonly at: string;
      readonly kind: 'process-started';
      readonly name: string;
    }
  | {
      readonly at: string;
      readonly kind: 'process-step';
      readonly step: string;
      /** Ramo escolhido, desfecho da aprovação, exceção ou observação do motor. */
      readonly detail?: string;
    }
  | {
      readonly at: string;
      readonly kind: 'process-finished';
      readonly name: string;
      readonly outcome?: string;
    }
  | {
      readonly at: string;
      readonly kind: 'process-cancelled';
      readonly name: string;
    }
  | {
      readonly at: string;
      readonly kind: 'process-removed';
      readonly name: string;
    };

/** Registro do histórico do card, com o que mudou na hora em que mudou (`at`, ISO 8601). */
export type CardActivity =
  | ProcessActivity
  | LinkActivity
  | { readonly at: string; readonly kind: 'created'; readonly lane: string }
  | {
      readonly at: string;
      readonly kind: 'moved';
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly at: string;
      readonly kind: 'renamed';
      readonly from: string;
      readonly to: string;
    }
  | { readonly at: string; readonly kind: 'description' }
  | {
      readonly at: string;
      readonly kind: 'parent';
      readonly from?: string;
      readonly to?: string;
    }
  | {
      readonly at: string;
      readonly kind: 'labels';
      readonly added: readonly string[];
      readonly removed: readonly string[];
    }
  | { readonly at: string; readonly kind: 'due'; readonly to?: string }
  | { readonly at: string; readonly kind: 'due-done'; readonly done: boolean }
  | {
      readonly at: string;
      readonly kind: 'checklist';
      readonly done: number;
      readonly total: number;
    }
  | { readonly at: string; readonly kind: 'archived' }
  | { readonly at: string; readonly kind: 'restored'; readonly lane: string }
  | { readonly at: string; readonly kind: 'duplicated'; readonly from: string }
  | { readonly at: string; readonly kind: 'assignee'; readonly to?: string }
  | {
      readonly at: string;
      readonly kind: 'attachment';
      readonly added?: string;
      readonly removed?: string;
    };

/** Pessoa que pode ser responsável pelos cards do quadro. */
export interface BoardPerson {
  readonly id: string;
  readonly name: string;
}

/** Comentário do card; o id só precisa ser único dentro do card. */
export interface CardComment {
  readonly id: string;
  /** Data e hora, ISO 8601. */
  readonly at: string;
  readonly author: string;
  readonly text: string;
}

/** Anexo do card: um link, ou um arquivo pequeno guardado como `data:` URL. */
export interface CardAttachment {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  /** Data e hora, ISO 8601. */
  readonly at: string;
  /** Tamanho do arquivo, em bytes; link não tem. */
  readonly size?: number;
}

/** Etapa do processo de outro card que este card executa. */
export interface CardStepLink {
  readonly cardId: string;
  /** Ficha parada na etapa; a ligação só vale enquanto a ficha existe. */
  readonly tokenId: string;
}

/** Card do quadro sem saber o que representa: identidade, texto e os dados genéricos de qualquer quadro. */
export interface BoardCard {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  /** Card pai na hierarquia; pai e filho podem estar em colunas diferentes. */
  readonly parentId?: string;
  /** Número sequencial no quadro, que forma o código (`QD-12`); só dado de entrada chega sem ele. */
  readonly number?: number;
  readonly labelIds?: readonly string[];
  /** Data do prazo, no formato `AAAA-MM-DD`. */
  readonly dueDate?: string;
  readonly dueDone?: boolean;
  readonly checklist?: readonly ChecklistItem[];
  /** Histórico do card, do mais antigo para o mais recente. */
  readonly activity?: readonly CardActivity[];
  /** Pessoa do quadro responsável pelo card. */
  readonly assigneeId?: string;
  /** Do mais antigo para o mais recente. */
  readonly comments?: readonly CardComment[];
  readonly attachments?: readonly CardAttachment[];
  /** Execução do processo deste card; o roteiro dela fica em `Board.processes`. */
  readonly process?: ProcessRun;
  /** Ids dos cards que bloqueiam este. */
  readonly blockedBy?: readonly string[];
  readonly stepOf?: CardStepLink;
}

/** Coluna do quadro; a ordem de `cards` é a ordem na tela. */
export interface BoardLane {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly BoardCard[];
  /** Máximo de cards esperado na coluna (o limite de WIP); passar dele só gera destaque, não bloqueia. */
  readonly wipLimit?: number;
  /** Fora da tela até alguém mostrar de novo; os cards continuam no quadro. */
  readonly hidden?: boolean;
  /** Não recebe nem solta cards, e a ordem deles não muda; editar o conteúdo dos cards continua valendo. */
  readonly locked?: boolean;
}

export type LabelColor =
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'
  | 'primary'
  | 'secondary';

/** Etiqueta do catálogo do quadro; os cards guardam só o id. */
export interface BoardLabel {
  readonly id: string;
  readonly name: string;
  readonly color: LabelColor;
}

/** Card que saiu do quadro arquivado, com a coluna de onde saiu para voltar a ela. */
export interface ArchivedCard {
  readonly card: BoardCard;
  readonly laneId: string;
}

/** Um arquivamento: o card escolhido (o primeiro da lista) e os descendentes, que saem e voltam juntos. */
export interface ArchiveEntry {
  /** Id do card escolhido. */
  readonly id: string;
  readonly archivedAt: string;
  readonly cards: readonly ArchivedCard[];
}

/** Roteiro congelado de uma versão de processo, guardado uma vez por quadro para os cards que a executam. */
export interface BoardProcess {
  readonly definitionId: string;
  readonly version: number;
  readonly name: string;
  readonly plan: ProcessPlan;
}

/** Regras opcionais do quadro; ausente vale desligada. Todas, menos `childInherits`, dependem da coluna de conclusão. */
export interface BoardRules {
  /** O pai não entra na coluna de conclusão com filha fora dela. */
  readonly parentWaitsChildren?: boolean;
  /** A última filha concluída leva o pai para a coluna de conclusão. */
  readonly parentFollowsChildren?: boolean;
  /** O card com processo em andamento não entra na coluna de conclusão. */
  readonly doneWaitsProcess?: boolean;
  /** O processo concluído leva o card para a coluna de conclusão. */
  readonly processEndMovesCard?: boolean;
  /** O card com bloqueador pendente não entra na coluna de conclusão. */
  readonly doneWaitsBlockers?: boolean;
  /** O card filho novo herda o responsável e as etiquetas do pai. */
  readonly childInherits?: boolean;
}

/** Configuração própria de cada quadro. */
export interface BoardConfig {
  /** Prefixo do código dos cards (`QD` em `QD-12`). */
  readonly keyPrefix: string;
  /** A coluna automática dos arquivados está oculta. */
  readonly archiveLaneHidden?: boolean;
  /** Pessoas que podem ser responsáveis pelos cards. */
  readonly people?: readonly BoardPerson[];
  /** Coluna que conta como concluída no progresso dos filhos de um card. */
  readonly doneLaneId?: string;
  readonly rules?: BoardRules;
}

/** O quadro inteiro: colunas, arquivados, etiquetas, configuração e o próximo número de card, que nunca volta atrás. */
export interface Board {
  readonly lanes: readonly BoardLane[];
  /** Do arquivamento mais recente para o mais antigo. */
  readonly archive: readonly ArchiveEntry[];
  readonly labels: readonly BoardLabel[];
  readonly nextNumber: number;
  readonly config: BoardConfig;
  /** Roteiros das execuções dos cards, um por versão de processo; o que nenhum card usa sai do quadro. */
  readonly processes?: readonly BoardProcess[];
}

export interface CardLocation {
  readonly lane: BoardLane;
  readonly laneIndex: number;
  readonly card: BoardCard;
  readonly cardIndex: number;
}

export interface FindCardParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
}

export function findCard(params: FindCardParams): CardLocation | undefined {
  const { lanes, cardId } = params;
  for (const [laneIndex, lane] of lanes.entries()) {
    const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
    const card = lane.cards[cardIndex];
    if (card) {
      return { lane, laneIndex, card, cardIndex };
    }
  }
  return undefined;
}

/** Todos os cards do quadro, coluna por coluna, na ordem da tela. */
export function allCards(lanes: readonly BoardLane[]): readonly BoardCard[] {
  return lanes.flatMap((lane) => lane.cards);
}

export interface UpdateCardInParams {
  readonly lanes: readonly BoardLane[];
  readonly cardId: string;
  readonly update: (card: BoardCard) => BoardCard;
}

/** Aplica `update` ao card; card inexistente ou `update` que devolve o mesmo card mantêm o próprio `lanes`. */
export function updateCardIn(params: UpdateCardInParams): readonly BoardLane[] {
  const { lanes, cardId, update } = params;
  const location = findCard({ lanes, cardId });
  if (!location) {
    return lanes;
  }
  const next = update(location.card);
  if (next === location.card) {
    return lanes;
  }
  const cards = [...location.lane.cards];
  cards[location.cardIndex] = next;
  const nextLanes = [...lanes];
  nextLanes[location.laneIndex] = { ...location.lane, cards };
  return nextLanes;
}
