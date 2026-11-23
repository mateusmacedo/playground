'use client';

import { useId, useState } from 'react';

import { announcementText } from './announcements';
import type { BoardLane } from './board';
import { KanbanCard, type KanbanCardActions } from './kanban-card';
import { KanbanLane } from './kanban-lane';
import { useDragAndDrop } from './use-drag-and-drop';
import { useKeyboardMove } from './use-keyboard-move';

/** Quadro kanban: arrastar com mouse ou toque, ou pegar com o teclado e mover com as setas. */
export function KanbanBoard({
  initialLanes,
}: Readonly<{ initialLanes: readonly BoardLane[] }>) {
  const [lanes, setLanes] = useState(initialLanes);
  const [announcement, setAnnouncement] = useState('');
  const instructionsId = useId();
  const keyboard = useKeyboardMove({
    lanes,
    setLanes,
    announce: setAnnouncement,
  });
  const drag = useDragAndDrop({
    lanes,
    onDragStart: keyboard.release,
    onDrop: (next, cardId) => {
      setLanes(next);
      setAnnouncement(
        announcementText({ kind: 'dropped', lanes: next, cardId }),
      );
    },
  });

  const actions: KanbanCardActions = {
    onDragStart: drag.onDragStart,
    onDragEnd: drag.onDragEnd,
    onHandleClick: keyboard.onHandleClick,
    onHandleKeyDown: keyboard.onHandleKeyDown,
    onHandleBlur: keyboard.onHandleBlur,
    registerHandle: keyboard.registerHandle,
  };

  return (
    <>
      <p id={instructionsId} className="small text-body-secondary">
        Arraste os cards entre as colunas. Pelo teclado, use a alça do card:
        Espaço ou Enter para pegar e soltar, as setas para mover e Esc para
        cancelar.
      </p>
      <div className="d-flex align-items-start gap-3 overflow-x-auto pb-2">
        {lanes.map((lane) => {
          const drop =
            drag.visibleDrop?.laneId === lane.id ? drag.visibleDrop : null;
          return (
            <KanbanLane
              key={lane.id}
              lane={lane}
              dropAtEnd={drop?.slot === lane.cards.length}
              onDragOver={drag.onDragOver}
              onDragLeave={drag.onDragLeave}
              onDrop={drag.onDrop}
            >
              {lane.cards.map((card, index) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  index={index}
                  dragging={drag.draggedId === card.id}
                  grabbed={keyboard.grabbedId === card.id}
                  dropBefore={drop?.slot === index}
                  instructionsId={instructionsId}
                  actions={actions}
                />
              ))}
            </KanbanLane>
          );
        })}
      </div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}
