import type { Metadata } from 'next';

import { BoardWorkspace } from './board-workspace';
import { sampleLabels, sampleLanes } from './model/sample-board';

export const metadata: Metadata = { title: 'Quadro' };

export default function BoardPage() {
  return (
    <div className="card mb-4 page-fill">
      <div className="card-body kanban-page__body">
        <h1 className="h4">Quadro</h1>
        <BoardWorkspace sampleLanes={sampleLanes} sampleLabels={sampleLabels} />
      </div>
    </div>
  );
}
