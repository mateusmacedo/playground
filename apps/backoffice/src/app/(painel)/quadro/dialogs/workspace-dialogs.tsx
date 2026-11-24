import { useRef, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import { DEFAULT_KEY_PREFIX } from '../model/config';
import type { BoardSummary } from '../model/workspace';
import { BoardFormDialog, type BoardFormValues } from './board-form-dialog';
import { OnClosed } from './on-closed';

/** Janela aberta, ou fechando: o pedido continua guardado até o fim da animação de saída. */
export interface WorkspaceDialog {
  /** Muda a cada abertura, para o conteúdo da janela começar do zero. */
  readonly key: number;
  readonly open: boolean;
  readonly kind: 'new' | 'remove';
  /** Quadro a excluir, guardado para o título não mudar enquanto a janela sai da tela. */
  readonly board?: BoardSummary;
}

export interface WorkspaceDialogState {
  readonly dialog: WorkspaceDialog | null;
  readonly openNew: () => void;
  readonly openRemove: (board: BoardSummary) => void;
  readonly close: () => void;
}

/** Janela aberta na lista de quadros: criar um quadro ou confirmar a exclusão de um. */
export function useWorkspaceDialog(): WorkspaceDialogState {
  const [dialog, setDialog] = useState<WorkspaceDialog | null>(null);
  const openCount = useRef(0);

  function nextKey(): number {
    openCount.current += 1;
    return openCount.current;
  }

  return {
    dialog,
    openNew: () => setDialog({ key: nextKey(), open: true, kind: 'new' }),
    openRemove: (board) =>
      setDialog({ key: nextKey(), open: true, kind: 'remove', board }),
    close: () => setDialog((current) => current && { ...current, open: false }),
  };
}

export interface WorkspaceDialogsProps {
  readonly dialog: WorkspaceDialog | null;
  /** Devolve o nome que vale para um quadro novo, ou `null` quando ele está vazio ou repetido. */
  readonly validateNewName: (name: string) => string | null;
  readonly onCreate: (values: BoardFormValues) => void;
  readonly onRemove: (boardId: string) => void;
  readonly onClose: () => void;
  /** A janela terminou de fechar. */
  readonly onClosed: () => void;
}

/** As janelas da lista de quadros: "Novo quadro" e a confirmação de exclusão. */
export function WorkspaceDialogs({
  dialog,
  validateNewName,
  onCreate,
  onRemove,
  onClose,
  onClosed,
}: Readonly<WorkspaceDialogsProps>) {
  if (!dialog) {
    return null;
  }
  // NOTE: o conteúdo da janela também desmonta uma vez ao abrir, quando vai para o portal; só vale o fim do fechamento.
  const closed = (
    <OnClosed
      onClosed={() => {
        if (!dialog.open) {
          onClosed();
        }
      }}
    />
  );

  if (dialog.kind === 'new') {
    return (
      <BoardFormDialog
        key={dialog.key}
        visible={dialog.open}
        title="Novo quadro"
        confirmLabel="Criar"
        initial={{ name: '', keyPrefix: DEFAULT_KEY_PREFIX }}
        suggestPrefix
        validateName={validateNewName}
        onSave={(values) => {
          onCreate(values);
          onClose();
        }}
        onCancel={onClose}
      >
        {closed}
      </BoardFormDialog>
    );
  }

  const { board } = dialog;
  if (!board) {
    return null;
  }
  return (
    <ConfirmModal
      key={dialog.key}
      visible={dialog.open}
      title={`Excluir o quadro ${board.name}`}
      confirmLabel="Excluir"
      confirmColor="danger"
      onConfirm={() => {
        onRemove(board.id);
        onClose();
      }}
      onCancel={onClose}
    >
      <p className="mb-0">
        O quadro sai da lista com todos os cards, inclusive os arquivados, e não
        pode ser recuperado.
      </p>
      {closed}
    </ConfirmModal>
  );
}
