import type { Metadata } from 'next';

import { BoardWorkspace } from './board-workspace';
import { sampleLabels, sampleLanes } from './model/sample-board';
import { StorageHint } from './storage-hint';

export const metadata: Metadata = { title: 'Quadro' };

export default function BoardPage() {
  return (
    <div className="card mb-4 page-fill">
      <div className="card-body kanban-page__body">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h1 className="h4 mb-0">Quadro</h1>
          <span className="badge text-bg-info">Beta</span>
          <StorageHint />
        </div>
        <BoardWorkspace sampleLanes={sampleLanes} sampleLabels={sampleLabels} />
      </div>
    </div>
  );
}
