'use client';

import { useRef } from 'react';

import { useOptionalSession } from '@/core/session/session-context';

import { BoardSwitcher } from './board-switcher';
import {
  useWorkspaceDialog,
  WorkspaceDialogs,
} from './dialogs/workspace-dialogs';
import { KanbanBoard } from './kanban-board';
import type { BoardLabel, BoardLane } from './model/board';
import {
  boardStorageKey,
  DEFAULT_BOARD_ID,
  validBoardName,
} from './model/workspace';
import { readRequestedBoard, useBoardAddress } from './use-board-address';
import { NEW_BOARD_LANES, useWorkspace } from './use-workspace';

export interface BoardWorkspaceProps {
  /** Conteúdo inicial do quadro principal; os quadros novos começam com colunas vazias. */
  readonly sampleLanes: readonly BoardLane[];
  readonly sampleLabels?: readonly BoardLabel[];
}

/**
 * Vários quadros, cada um com o próprio conteúdo e configuração: escolher, criar e excluir. O quadro aberto vai para o
 * endereço (`?quadro=<id>`), para o link copiado de um card abrir no quadro certo.
 */
export function BoardWorkspace({
  sampleLanes,
  sampleLabels,
}: Readonly<BoardWorkspaceProps>) {
  const author = useOptionalSession()?.user?.displayName;
  const { boards, activeId, loaded, commands } = useWorkspace({
    readRequestedId: readRequestedBoard,
  });
  const workspaceDialog = useWorkspaceDialog();
  const selectRef = useRef<HTMLSelectElement>(null);
  const active = boards.find((board) => board.id === activeId);
  const isMainBoard = active?.id === DEFAULT_BOARD_ID;

  useBoardAddress({ ready: loaded, boardId: activeId });

  return (
    <>
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
