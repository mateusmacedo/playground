import type { RunAction } from '@/shared/process/engine';

import type {
  BoardLabel,
  BoardLane,
  BoardPerson,
  BoardProcess,
  BoardRules,
  CardAttachment,
} from './model/board';
import type { CardPatch } from './model/cards';

export interface SetLanesChange {
  readonly lanes: readonly BoardLane[];
  /** Mudanças seguidas com a mesma chave são um passo só do desfazer. */
  readonly key?: string;
}

export interface RenameLaneChange {
  readonly laneId: string;
  readonly title: string;
}

export interface RemoveLaneChange {
  readonly laneId: string;
  readonly moveCardsTo?: string;
}

export interface SetWipLimitChange {
  readonly laneId: string;
  readonly limit: number | undefined;
}

export interface SetLaneHiddenChange {
  readonly laneId: string;
  readonly hidden: boolean;
}

export interface SetLaneLockedChange {
  readonly laneId: string;
  readonly locked: boolean;
}

export interface AddCardInput {
  readonly laneId: string;
  readonly title: string;
  readonly parentId?: string;
}

export interface UpdateCardChange {
  readonly cardId: string;
  readonly patch: CardPatch;
}

export interface MoveCardToLaneChange {
  readonly cardId: string;
  readonly laneId: string;
}

export interface SetParentChange {
  readonly cardId: string;
  readonly parentId: string | undefined;
}

export interface SetAssigneeChange {
  readonly cardId: string;
  readonly assigneeId: string | undefined;
}

export interface SetDueDateChange {
  readonly cardId: string;
  readonly dueDate: string | undefined;
}

export interface SetDueDoneChange {
  readonly cardId: string;
  readonly done: boolean;
}

export interface AddChecklistItemChange {
  readonly cardId: string;
  readonly text: string;
}

export interface ChecklistItemChange {
  readonly cardId: string;
  readonly itemId: string;
}

export interface AddCommentChange {
  readonly cardId: string;
  readonly author: string;
  readonly text: string;
}

export interface RemoveCommentChange {
  readonly cardId: string;
  readonly commentId: string;
}

export interface AddAttachmentChange {
  readonly cardId: string;
  readonly attachment: Omit<CardAttachment, 'id' | 'at'>;
}

export interface RemoveAttachmentChange {
  readonly cardId: string;
  readonly attachmentId: string;
}

export interface ToggleLabelChange {
  readonly cardId: string;
  readonly labelId: string;
}

export interface CreateLabelInput {
  readonly name: string;
  readonly color: BoardLabel['color'];
  /** Card que já recebe a etiqueta criada. */
  readonly cardId?: string;
}

export interface UpdateLabelChange {
  readonly labelId: string;
  readonly patch: Partial<Pick<BoardLabel, 'name' | 'color'>>;
}

export interface ConfigureSettings {
  /** Prefixo do código dos cards; inválido não muda nada. */
  readonly keyPrefix?: string;
  /** Coluna que conta como concluída; `null` tira. */
  readonly doneLaneId?: string | null;
  /** Pessoas do quadro; quem sai deixa de ser responsável pelos cards. */
  readonly people?: readonly BoardPerson[];
  /** O conjunto inteiro das regras do quadro: a que não vier ligada fica desligada. */
  readonly rules?: BoardRules;
}

export interface StartProcessChange {
  readonly cardId: string;
  /** Versão publicada que o card vai seguir, com o roteiro dela. */
  readonly process: BoardProcess;
  /** Quem iniciou, para a trilha da execução. */
  readonly by?: string;
}

export interface AdvanceProcessChange {
  readonly cardId: string;
  readonly action: RunAction;
  /** Quem agiu, para a trilha da execução. */
  readonly by?: string;
}

export interface DelegateStepChange {
  /** Card dono do processo. */
  readonly cardId: string;
  /** Ficha parada na etapa que o card filho vai executar. */
  readonly tokenId: string;
  /** Quem entregou a etapa, para a trilha da execução. */
  readonly by?: string;
}

export interface BlockerChange {
  /** Card bloqueado. */
  readonly cardId: string;
  /** Card que bloqueia. */
  readonly blockerId: string;
}

/** O que as telas do quadro pedem; cada comando vira um passo do desfazer e um registro no histórico do card. */
export interface BoardCommands {
  /** Fecha o passo atual: o próximo registro vira um passo novo. */
  readonly seal: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  /** Aplica a configuração do quadro num passo só. */
  readonly configure: (settings: ConfigureSettings) => void;
  /** Volta às colunas e aos cards iniciais, mantendo a configuração. */
  readonly reset: () => void;

  /** Troca as colunas de uma vez, depois de um arraste ou de um passo pelo teclado. */
  readonly setLanes: (change: SetLanesChange) => void;
  /** Devolve o id da coluna criada, ou `undefined` quando o nome veio vazio. */
  readonly addLane: (title: string) => string | undefined;
  readonly renameLane: (change: RenameLaneChange) => void;
  readonly removeLane: (change: RemoveLaneChange) => void;
  readonly setWipLimit: (change: SetWipLimitChange) => void;
  /** Oculta ou mostra a coluna; a última visível não sai da tela. */
  readonly setLaneHidden: (change: SetLaneHiddenChange) => void;
  readonly showAllLanes: () => void;
  readonly setLaneLocked: (change: SetLaneLockedChange) => void;
  readonly setArchiveLaneHidden: (hidden: boolean) => void;

  /** Devolve o id do card criado, ou `undefined` quando o título veio vazio. */
  readonly addCard: (card: AddCardInput) => string | undefined;
  readonly updateCard: (change: UpdateCardChange) => void;
  readonly moveCardToLane: (change: MoveCardToLaneChange) => void;
  readonly setParent: (change: SetParentChange) => void;
  readonly removeCard: (cardId: string) => void;
  /** Devolve o id da cópia. */
  readonly duplicateCard: (cardId: string) => string | undefined;

  readonly setAssignee: (change: SetAssigneeChange) => void;
  readonly setDueDate: (change: SetDueDateChange) => void;
  readonly setDueDone: (change: SetDueDoneChange) => void;
  readonly addChecklistItem: (change: AddChecklistItemChange) => void;
  readonly toggleChecklistItem: (change: ChecklistItemChange) => void;
  readonly removeChecklistItem: (change: ChecklistItemChange) => void;
  readonly addComment: (change: AddCommentChange) => void;
  readonly removeComment: (change: RemoveCommentChange) => void;
  readonly addAttachment: (change: AddAttachmentChange) => void;
  readonly removeAttachment: (change: RemoveAttachmentChange) => void;

  readonly toggleLabel: (change: ToggleLabelChange) => void;
  /** Devolve o id da etiqueta criada, ou `undefined` quando o nome veio vazio ou repetido. */
  readonly createLabel: (label: CreateLabelInput) => string | undefined;
  readonly updateLabel: (change: UpdateLabelChange) => void;
  readonly removeLabel: (labelId: string) => void;

  readonly archiveCard: (cardId: string) => void;
  readonly restoreArchived: (entryId: string) => void;
  readonly deleteArchived: (entryId: string) => void;

  /** Inicia o processo no card. Devolve o motivo da recusa, ou `undefined` quando iniciou. */
  readonly startProcess: (change: StartProcessChange) => string | undefined;
  /** Age numa etapa do processo do card. Devolve o motivo da recusa, ou `undefined` quando aplicou. */
  readonly advanceProcess: (change: AdvanceProcessChange) => string | undefined;
  /** Tira do card a execução concluída ou cancelada; o histórico do card fica. */
  readonly removeProcess: (cardId: string) => void;
  /** Entrega a etapa a um card filho novo. Devolve o id dele, ou `undefined` quando o quadro recusou e avisou. */
  readonly delegateStep: (change: DelegateStepChange) => string | undefined;

  /**
   * Faz um card bloquear outro. Devolve o motivo da recusa (o próprio card, card fora das colunas, ciclo de
   * dependência), ou `undefined` quando aplicou.
   */
  readonly addBlocker: (change: BlockerChange) => string | undefined;
  readonly removeBlocker: (change: BlockerChange) => void;
  /** O item do checklist vira card filho. Devolve o id dele, ou `undefined` quando o quadro recusou e avisou. */
  readonly convertChecklistItem: (
    change: ChecklistItemChange,
  ) => string | undefined;
  /** Duplica o card com todas as descendentes. Devolve o id da cópia, ou `undefined` quando o quadro recusou e avisou. */
  readonly duplicateCardTree: (cardId: string) => string | undefined;
}
