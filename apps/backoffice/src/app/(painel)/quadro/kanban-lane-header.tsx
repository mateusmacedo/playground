import { cilLockLocked, cilMove, cilOptions } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormInput,
} from '@coreui/react';
import { type DragEvent, type KeyboardEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { BoardLane } from './model/board';
import { isOverLimit } from './model/lanes';

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
  readonly registerHandle: (handle: {
    readonly id: string;
    readonly element: HTMLButtonElement | null;
  }) => void;
  readonly onRename: (change: {
    readonly laneId: string;
    readonly title: string;
  }) => void;
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

/** Contador de cards da coluna, com o limite e o aviso de excesso para o leitor de tela. */
export function CardCount({ lane }: Readonly<{ lane: BoardLane }>) {
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
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // WHY: o campo sai da tela no Esc; se o navegador disparar o blur nessa saída, ele não pode salvar o rascunho.
  const cancelled = useRef(false);

  function startRename() {
    cancelled.current = false;
    flushSync(() => setDraft(lane.title));
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function finish(save: boolean) {
    if (draft !== null && save) {
      actions.onRename({ laneId: lane.id, title: draft });
    }
    setDraft(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    cancelled.current = event.key === 'Escape';
    flushSync(() => finish(event.key === 'Enter'));
    titleRef.current?.focus();
  }

  return (
    <header className="card-header d-flex align-items-center gap-1 ps-1 pe-1">
      <button
        type="button"
        className="btn btn-sm btn-ghost-secondary"
        draggable
        aria-label={`Mover a coluna ${lane.title}`}
        aria-describedby={instructionsId}
        aria-pressed={grabbed}
        ref={(element) => actions.registerHandle({ id: lane.id, element })}
        onClick={() => actions.onHandleClick(lane.id)}
        onKeyDown={(event) => actions.onHandleKeyDown(event, lane.id)}
        onBlur={() => actions.onHandleBlur(lane.id)}
        onDragStart={(event) => actions.onHandleDragStart(event, lane.id)}
        onDragEnd={actions.onHandleDragEnd}
      >
        <CIcon icon={cilMove} aria-hidden="true" />
      </button>
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        data-lane-title={lane.id}
        className={`h6 mb-0 flex-grow-1 text-truncate${draft === null ? '' : ' visually-hidden'}`}
      >
        {lane.title}
      </h2>
      {draft === null ? null : (
        <CFormInput
          ref={inputRef}
          size="sm"
          className="flex-grow-1"
          aria-label="Nome da coluna"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!cancelled.current) {
              finish(true);
            }
          }}
        />
      )}
      {lane.locked ? (
        <span className="text-body-secondary" title="Coluna bloqueada">
          <CIcon icon={cilLockLocked} aria-hidden="true" />
          <span className="visually-hidden">Coluna bloqueada</span>
        </span>
      ) : null}
      <CardCount lane={lane} />
      <CDropdown placement="bottom-end">
        <CDropdownToggle
          color="secondary"
          variant="ghost"
          size="sm"
          caret={false}
          aria-label={`Ações da coluna ${lane.title}`}
        >
          <CIcon icon={cilOptions} aria-hidden="true" />
        </CDropdownToggle>
        <CDropdownMenu>
          <CDropdownItem as="button" type="button" onClick={startRename}>
            Renomear
          </CDropdownItem>
          <CDropdownItem
            as="button"
            type="button"
            onClick={() => actions.onRequestLimit(lane.id)}
          >
            Limite de cards
          </CDropdownItem>
          <CDropdownItem
            as="button"
            type="button"
            onClick={() => actions.onToggleCollapse(lane.id)}
          >
            Recolher coluna
          </CDropdownItem>
          <CDropdownItem
            as="button"
            type="button"
            disabled={!canHide}
            onClick={() => actions.onHide(lane.id)}
          >
            Ocultar coluna
          </CDropdownItem>
          <CDropdownItem
            as="button"
            type="button"
            onClick={() => actions.onToggleLock(lane.id)}
          >
            {lane.locked ? 'Liberar coluna' : 'Bloquear coluna'}
          </CDropdownItem>
          <CDropdownItem
            as="button"
            type="button"
            disabled={!canRemove || lane.locked}
            onClick={() => actions.onRequestRemove(lane.id)}
          >
            Excluir coluna
          </CDropdownItem>
        </CDropdownMenu>
      </CDropdown>
    </header>
  );
}
