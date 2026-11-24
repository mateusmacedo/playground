'use client';

import { cilPlus, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormSelect } from '@coreui/react';
import { useEffect, useId, useRef, useState } from 'react';

import { useOptionalSession } from '@/core/session/session-context';
import { ConfirmModal } from '@/shared/ui/confirm-modal';

import { BoardFormDialog } from './dialogs/board-form-dialog';
import { OnClosed } from './dialogs/on-closed';
import { KanbanBoard } from './kanban-board';
import type { BoardLabel, BoardLane } from './model/board';
import { DEFAULT_KEY_PREFIX } from './model/config';
import {
  type BoardSummary,
  boardStorageKey,
  DEFAULT_BOARD_ID,
  validBoardName,
} from './model/workspace';
import { NEW_BOARD_LANES, useWorkspace } from './use-workspace';

const BOARD_PARAM = 'quadro';

/** Janela aberta, ou fechando: o pedido continua guardado até o fim da animação de saída. */
interface WorkspaceDialog {
  readonly key: number;
  readonly open: boolean;
  readonly kind: 'new' | 'remove';
  /** Quadro a excluir, guardado para o título não mudar enquanto a janela sai da tela. */
  readonly board?: BoardSummary;
}

function readRequestedBoard(): string | null {
  return new URLSearchParams(window.location.search).get(BOARD_PARAM);
}

/**
 * Vários quadros, cada um com o próprio conteúdo e configuração: escolher, criar e excluir. O quadro aberto vai para o
 * endereço (`?quadro=<id>`), para o link copiado de um card abrir no quadro certo.
 */
export function BoardWorkspace({
  sampleLanes,
  sampleLabels,
}: Readonly<{
  /** Conteúdo inicial do quadro principal; os quadros novos começam com colunas vazias. */
  sampleLanes: readonly BoardLane[];
  sampleLabels?: readonly BoardLabel[];
}>) {
  const author = useOptionalSession()?.user?.displayName;
  const { boards, activeId, loaded, commands } = useWorkspace({
    readRequestedId: readRequestedBoard,
  });
  const [dialog, setDialog] = useState<WorkspaceDialog | null>(null);
  const dialogCount = useRef(0);
  const selectRef = useRef<HTMLSelectElement>(null);
  const selectId = useId();
  const active = boards.find((board) => board.id === activeId);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    const url = new URL(window.location.href);
    const shown = url.searchParams.get(BOARD_PARAM);
    if (shown === activeId) {
      return;
    }
    url.searchParams.set(BOARD_PARAM, activeId);
    // NOTE: o card do endereço é de outro quadro só quando o endereço já apontava para um quadro.
    if (shown !== null) {
      url.searchParams.delete('card');
    }
    // WHY: o Next integra o `replaceState` nativo ao roteador; o endereço muda sem recarregar nem criar entrada nova.
    window.history.replaceState(window.history.state, '', url.href);
  }, [loaded, activeId]);

  function openDialog(kind: WorkspaceDialog['kind']) {
    dialogCount.current += 1;
    setDialog({ key: dialogCount.current, open: true, kind, board: active });
  }

  function closeDialog() {
    setDialog((current) => current && { ...current, open: false });
  }

  const closed = dialog ? (
    <OnClosed
      onClosed={() => {
        if (!dialog.open) {
          selectRef.current?.focus();
        }
      }}
    />
  ) : null;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div>
          <CFormSelect
            ref={selectRef}
            id={selectId}
            label="Quadro"
            size="sm"
            value={activeId}
            onChange={(event) => commands.select(event.target.value)}
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </CFormSelect>
        </div>
        <CButton
          type="button"
          color="primary"
          variant="outline"
          size="sm"
          onClick={() => openDialog('new')}
        >
          <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
          Novo quadro
        </CButton>
        {boards.length > 1 ? (
          <CButton
            type="button"
            color="danger"
            variant="outline"
            size="sm"
            onClick={() => openDialog('remove')}
          >
            <CIcon icon={cilTrash} aria-hidden="true" className="me-1" />
            Excluir quadro
          </CButton>
        ) : null}
      </div>
      {/* NOTE: antes de ler a lista gravada, mostra o quadro principal, que já vem pronto do servidor; se o aberto for
          outro, a troca acontece no mesmo passo em que a lista é lida. */}
      {active ? (
        <KanbanBoard
          key={active.id}
          initialLanes={
            active.id === DEFAULT_BOARD_ID ? sampleLanes : NEW_BOARD_LANES
          }
          initialLabels={
            active.id === DEFAULT_BOARD_ID ? sampleLabels : undefined
          }
          storageKey={boardStorageKey(active.id)}
          canReset={active.id === DEFAULT_BOARD_ID}
          author={author}
          settings={{
            name: active.name,
            validateName: (name) =>
              validBoardName({ boards, name, boardId: active.id }),
            onRename: (name) => commands.rename({ boardId: active.id, name }),
          }}
        />
      ) : null}
      {dialog?.kind === 'new' ? (
        <BoardFormDialog
          key={dialog.key}
          visible={dialog.open}
          title="Novo quadro"
          confirmLabel="Criar"
          initial={{ name: '', keyPrefix: DEFAULT_KEY_PREFIX }}
          suggestPrefix
          validateName={(name) => validBoardName({ boards, name })}
          onSave={(values) => {
            commands.create(values);
            closeDialog();
          }}
          onCancel={closeDialog}
        >
          {closed}
        </BoardFormDialog>
      ) : null}
      {dialog?.kind === 'remove' && dialog.board ? (
        <ConfirmModal
          key={dialog.key}
          visible={dialog.open}
          title={`Excluir o quadro ${dialog.board.name}`}
          confirmLabel="Excluir"
          confirmColor="danger"
          onConfirm={() => {
            if (dialog.board) {
              commands.remove(dialog.board.id);
            }
            closeDialog();
          }}
          onCancel={closeDialog}
        >
          <p className="mb-0">
            O quadro sai da lista com todos os cards, inclusive os arquivados, e
            não pode ser recuperado.
          </p>
          {closed}
        </ConfirmModal>
      ) : null}
    </>
  );
}
