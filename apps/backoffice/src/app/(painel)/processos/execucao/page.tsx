import type { Metadata } from 'next';

import { RunsView } from './runs-view';

export const metadata: Metadata = { title: 'Execuções' };

export default function ProcessRunsPage() {
  return (
    <div className="card mb-4 page-fill">
      <div className="card-body process-page__body">
        <RunsView />
      </div>
    </div>
  );
}
