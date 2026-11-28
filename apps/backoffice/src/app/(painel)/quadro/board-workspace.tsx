'use client';

import { CAlert } from '@coreui/react';
import { useRef } from 'react';

import { useOptionalSession } from '@/core/session/session-context';

import { BoardLoadState } from './board-load-state';
import { BoardSwitcher } from './board-switcher';
import {
  useWorkspaceDialog,
  WorkspaceDialogs,
} from './dialogs/workspace-dialogs';
import { KanbanBoard } from './kanban-board';
import type { BoardLabel, BoardLane } from './model/board';
import { createBoard } from './model/board-state';
import {
  boardStorageKey,
  DEFAULT_BOARD_ID,
  validBoardName,
} from './model/workspace';
import { useWorkspaceStore } from './store/use-workspace-store';
import { readRequestedBoard, useBoardAddress } from './use-board-address';
import { NEW_BOARD_LANES, useWorkspace } from './use-workspace';

export interface BoardWorkspaceProps {
  /** Conteúdo inicial do quadro principal; os quadros novos começam com colunas vazias. */
  readonly sampleLanes: readonly BoardLane[];
  readonly sampleLabels?: readonly BoardLabel[];
}

/**
 * Vários quadros, cada um com o próprio conteúdo e configuração: escolher, criar e excluir. O quadro aberto vai para o
 * endereço (`?quadro=<id>`), para o link copiado de um card abrir no quadro certo. Os quadros ficam na API do painel,
 * quando ela está ligada, ou no navegador; a lista que vem da API dá lugar ao aviso de carregando, e ao de erro com
 * nova tentativa, enquanto não chega.
 */
export function BoardWorkspace({
  sampleLanes,
  sampleLabels,
}: Readonly<BoardWorkspaceProps>) {
  const author = useOptionalSession()?.user?.displayName;
  const store = useWorkspaceStore({
    defaultContent: () =>
      createBoard({ lanes: sampleLanes, labels: sampleLabels }),
  });
  const workspace = useWorkspace({
    store,
    readRequestedId: readRequestedBoard,
  });
  const { boards, activeId, loaded, phase, commands } = workspace;
  const workspaceDialog = useWorkspaceDialog();
  const selectRef = useRef<HTMLSelectElement>(null);
  const active = boards.find((board) => board.id === activeId);
  const isMainBoard = active?.id === DEFAULT_BOARD_ID;

  useBoardAddress({ ready: loaded, boardId: activeId });

  if (phase.kind !== 'ready') {
    return (
      <BoardLoadState
        phase={phase}
        loadingLabel="Carregando os quadros…"
        failedMessage="Não foi possível carregar os quadros."
        onRetry={workspace.retryLoad}
      />
    );
  }

  return (
    <>
      {workspace.failure ? (
        <CAlert
          color="danger"
          dismissible
          className="py-2"
          onClose={workspace.dismissFailure}
        >
          {workspace.failure}
        </CAlert>
      ) : null}
      <BoardSwitcher
        boards={boards}
        activeId={activeId}
        selectRef={selectRef}
        onSelect={commands.select}
        onNew={workspaceDialog.openNew}
        onRemove={() => {
          if (active) {
            workspaceDialog.openRemove(active);
          }
        }}
      />
      {/* NOTE: antes de ler a lista gravada, mostra o quadro principal, que já vem pronto do servidor; se o aberto for
          outro, a troca acontece no mesmo passo em que a lista é lida. */}
      {active ? (
        <KanbanBoard
          key={active.id}
          initialLanes={isMainBoard ? sampleLanes : NEW_BOARD_LANES}
          initialLabels={isMainBoard ? sampleLabels : undefined}
          storageKey={boardStorageKey(active.id)}
          store={store.board(active.id)}
          canReset={isMainBoard}
          author={author}
          settings={{
            name: active.name,
            validateName: (name) =>
              validBoardName({ boards, name, boardId: active.id }),
            onRename: (name) => commands.rename({ boardId: active.id, name }),
          }}
        />
      ) : null}
      <WorkspaceDialogs
        dialog={workspaceDialog.dialog}
        validateNewName={(name) => validBoardName({ boards, name })}
        onCreate={commands.create}
        onRemove={commands.remove}
        onClose={workspaceDialog.close}
        onClosed={() => selectRef.current?.focus()}
      />
    </>
  );
}
