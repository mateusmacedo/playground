import { cilLockLocked, cilMove } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CFormInput } from '@coreui/react';
import type { DragEvent, KeyboardEvent } from 'react';

import { LaneMenu } from './lane-menu';
import type { BoardLane } from './model/board';
import { isOverLimit } from './model/lanes';
import type { HandleRegistration } from './use-keyboard-move';
import { useLaneRename } from './use-lane-rename';

export interface LaneRename {
  readonly laneId: string;
  readonly title: string;
}

/** O que o quadro faz com a alça, o nome e o menu da coluna. */
export interface LaneHeaderActions {
  readonly onHandleDragStart: (
    event: DragEvent<HTMLElement>,
    laneId: string,
  ) => void;
  readonly onHandleDragEnd: () => void;
  readonly onHandleClick: (laneId: string) => void;
  readonly onHandleKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    laneId: string,
  ) => void;
  readonly onHandleBlur: (laneId: string) => void;
  readonly registerHandle: (handle: HandleRegistration) => void;
  readonly onRename: (change: LaneRename) => void;
  readonly onRequestLimit: (laneId: string) => void;
  readonly onRequestRemove: (laneId: string) => void;
  /** Recolhe a coluna expandida, ou expande a recolhida. */
  readonly onToggleCollapse: (laneId: string) => void;
  readonly onHide: (laneId: string) => void;
  /** Bloqueia a coluna liberada, ou libera a bloqueada. */
  readonly onToggleLock: (laneId: string) => void;
}

export interface KanbanLaneHeaderProps {
  readonly lane: BoardLane;
  /** Id do título, que dá nome à coluna. */
  readonly titleId: string;
  /** Coluna pega pelo teclado, esperando as setas. */
  readonly grabbed: boolean;
  /** A última coluna do quadro não pode ser excluída. */
  readonly canRemove: boolean;
  /** A última coluna visível não pode ser ocultada. */
  readonly canHide: boolean;
  readonly instructionsId: string;
  readonly actions: LaneHeaderActions;
}

export interface CardCountProps {
  readonly lane: BoardLane;
}

/** Contador de cards da coluna, com o limite e o aviso de excesso para o leitor de tela. */
export function CardCount({ lane }: Readonly<CardCountProps>) {
  const count = lane.cards.length;
  const over = isOverLimit(lane);
  return (
    <span className={`badge ${over ? 'text-bg-danger' : 'text-bg-secondary'}`}>
      {count}
      {lane.wipLimit === undefined ? null : ` de ${lane.wipLimit}`}
      <span className="visually-hidden">
        {count === 1 ? ' card' : ' cards'}
        {over ? ', acima do limite' : ''}
      </span>
    </span>
  );
}

/** Cabeçalho da coluna: alça de mover, nome (editável no lugar), contador com o limite e o menu de ações. */
export function KanbanLaneHeader({
  lane,
  titleId,
  grabbed,
  canRemove,
  canHide,
  instructionsId,
  actions,
}: Readonly<KanbanLaneHeaderProps>) {
  const laneId = lane.id;
  const rename = useLaneRename({
    title: lane.title,
    onRename: (title) => actions.onRename({ laneId, title }),
  });
  const renaming = rename.draft !== null;

  return (
    <header className="card-header d-flex align-items-center gap-1 ps-1 pe-1">
      <button
        type="button"
        className="btn btn-sm btn-ghost-secondary"
        draggable
        aria-label={`Mover a coluna ${lane.title}`}
        aria-describedby={instructionsId}
        aria-pressed={grabbed}
        ref={(element) => actions.registerHandle({ id: laneId, element })}
        onClick={() => actions.onHandleClick(laneId)}
        onKeyDown={(event) => actions.onHandleKeyDown(event, laneId)}
        onBlur={() => actions.onHandleBlur(laneId)}
        onDragStart={(event) => actions.onHandleDragStart(event, laneId)}
        onDragEnd={actions.onHandleDragEnd}
      >
        <CIcon icon={cilMove} aria-hidden="true" />
      </button>
      <h2
        id={titleId}
        ref={rename.titleRef}
        tabIndex={-1}
        data-lane-title={laneId}
        className={`h6 mb-0 flex-grow-1 text-truncate${renaming ? ' visually-hidden' : ''}`}
      >
        {lane.title}
      </h2>
      {rename.draft === null ? null : (
        <CFormInput
          ref={rename.inputRef}
          size="sm"
          className="flex-grow-1"
          aria-label="Nome da coluna"
          value={rename.draft}
          onChange={(event) => rename.onChange(event.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
        />
      )}
      {lane.locked ? (
        <span className="text-body-secondary" title="Coluna bloqueada">
          <CIcon icon={cilLockLocked} aria-hidden="true" />
          <span className="visually-hidden">Coluna bloqueada</span>
        </span>
      ) : null}
      <CardCount lane={lane} />
      <LaneMenu
        lane={lane}
        canRemove={canRemove}
        canHide={canHide}
        onRename={rename.start}
        onRequestLimit={() => actions.onRequestLimit(laneId)}
        onToggleCollapse={() => actions.onToggleCollapse(laneId)}
        onHide={() => actions.onHide(laneId)}
        onToggleLock={() => actions.onToggleLock(laneId)}
        onRequestRemove={() => actions.onRequestRemove(laneId)}
      />
    </header>
  );
}
