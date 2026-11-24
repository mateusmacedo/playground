import { ConfirmModal } from '@/shared/ui/confirm-modal';

import { LaneLimitDialog, RemoveLaneDialog } from './lane-dialogs';
import type { BoardCard, BoardLane } from './model/board';
import { OnClosed } from './on-closed';

export type BoardDialogRequest =
  | { readonly kind: 'limit'; readonly lane: BoardLane }
  | { readonly kind: 'remove-lane'; readonly lane: BoardLane }
  | {
      readonly kind: 'remove-card';
      readonly card: BoardCard;
      readonly childCount: number;
      /** Título do pai do card, que recebe os filhos. */
      readonly parentTitle?: string;
    }
  | { readonly kind: 'reset' };

/** Janela aberta, ou fechando: o pedido continua guardado até o fim da animação de saída. */
export interface BoardDialog {
  /** Muda a cada abertura, para o conteúdo da janela começar do zero. */
  readonly key: number;
  readonly open: boolean;
  readonly request: BoardDialogRequest;
  /** Coluna cujo título recebe o foco quando a janela termina de fechar; sem ela, o foco vai para "Restaurar exemplo". */
  readonly focusLaneId?: string;
}

export interface BoardDialogHandlers {
  readonly onSaveLimit: (change: {
    readonly laneId: string;
    readonly limit: number | undefined;
  }) => void;
  readonly onRemoveLane: (change: {
    readonly laneId: string;
    readonly moveCardsTo?: string;
  }) => void;
  readonly onRemoveCard: (cardId: string) => void;
  readonly onReset: () => void;
  readonly onCancel: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: (focusLaneId: string | undefined) => void;
}

function removeCardText(
  request: Extract<BoardDialogRequest, { kind: 'remove-card' }>,
): string {
  const { childCount, parentTitle } = request;
  if (childCount === 0) {
    return 'O card sai do quadro.';
  }
  const children =
    childCount === 1
      ? 'O card filho dele'
      : `Os ${childCount} cards filhos dele`;
  const verb = childCount === 1 ? 'passa' : 'passam';
  return parentTitle
    ? `O card sai do quadro. ${children} ${verb} para ${parentTitle}.`
    : `O card sai do quadro. ${children} ${verb} a ficar sem card pai.`;
}

/** As janelas de confirmação do quadro; só uma fica aberta por vez. */
export function BoardDialogs({
  dialog,
  lanes,
  handlers,
}: Readonly<{
  dialog: BoardDialog | null;
  lanes: readonly BoardLane[];
  handlers: BoardDialogHandlers;
}>) {
  if (!dialog) {
    return null;
  }
  const { key, open, request } = dialog;
  // NOTE: o conteúdo da janela também desmonta uma vez ao abrir, quando vai para o portal; só vale o fim do fechamento.
  const closed = (
    <OnClosed
      onClosed={() => {
        if (!open) {
          handlers.onClosed(dialog.focusLaneId);
        }
      }}
    />
  );
  switch (request.kind) {
    case 'limit':
      return (
        <LaneLimitDialog
          key={key}
          visible={open}
          lane={request.lane}
          onSave={(limit) =>
            handlers.onSaveLimit({ laneId: request.lane.id, limit })
          }
          onCancel={handlers.onCancel}
        >
          {closed}
        </LaneLimitDialog>
      );
    case 'remove-lane':
      return (
        <RemoveLaneDialog
          key={key}
          visible={open}
          lane={request.lane}
          lanes={lanes}
          onConfirm={handlers.onRemoveLane}
          onCancel={handlers.onCancel}
        >
          {closed}
        </RemoveLaneDialog>
      );
    case 'remove-card':
      return (
        <ConfirmModal
          key={key}
          visible={open}
          title={`Excluir o card ${request.card.title}`}
          confirmLabel="Excluir"
          confirmColor="danger"
          onConfirm={() => handlers.onRemoveCard(request.card.id)}
          onCancel={handlers.onCancel}
        >
          <p className="mb-0">{removeCardText(request)}</p>
          {closed}
        </ConfirmModal>
      );
    case 'reset':
      return (
        <ConfirmModal
          key={key}
          visible={open}
          title="Restaurar o quadro de exemplo"
          confirmLabel="Restaurar"
          confirmColor="danger"
          onConfirm={handlers.onReset}
          onCancel={handlers.onCancel}
        >
          <p className="mb-0">
            O quadro volta às colunas e aos cards de exemplo, e o que foi criado
            ou alterado se perde.
          </p>
          {closed}
        </ConfirmModal>
      );
  }
}
