import type { Metadata } from 'next';

import { KanbanBoard } from './kanban-board';
import { sampleLanes } from './model/sample-board';
import { BOARD_STORAGE_KEY } from './model/storage';

export const metadata: Metadata = { title: 'Quadro' };

export default function BoardPage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Quadro</h1>
        <KanbanBoard
          initialLanes={sampleLanes}
          storageKey={BOARD_STORAGE_KEY}
        />
      </div>
    </div>
  );
}
