import type { Metadata } from 'next';

import { KanbanBoard } from './kanban-board';
import { sampleLanes } from './sample-board';

export const metadata: Metadata = { title: 'Quadro' };

export default function BoardPage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Quadro</h1>
        <KanbanBoard initialLanes={sampleLanes} />
      </div>
    </div>
  );
}
