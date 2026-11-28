import { CButton, CButtonGroup, CFormSwitch } from '@coreui/react';
import { useId } from 'react';

import type { BoardView, BoardViewMode } from '../use-board-view';

const MODES: readonly {
  readonly mode: BoardViewMode;
  readonly label: string;
}[] = [
  { mode: 'board', label: 'Quadro' },
  { mode: 'list', label: 'Lista' },
  { mode: 'steps', label: 'Etapas' },
];

export interface ViewSwitchProps {
  readonly view: BoardView;
  readonly onChange: (change: Partial<BoardView>) => void;
}

/**
 * Troca entre o quadro, a lista e as etapas pendentes dos processos, liga as linhas por card pai no quadro e a
 * árvore na lista.
 */
export function ViewSwitch({ view, onChange }: Readonly<ViewSwitchProps>) {
  const groupedId = useId();
  const treeId = useId();
  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <CButtonGroup size="sm" role="group" aria-label="Visão">
        {MODES.map(({ mode, label }) => (
          <CButton
            key={mode}
            type="button"
            color="secondary"
            variant={view.mode === mode ? undefined : 'outline'}
            aria-pressed={view.mode === mode}
            onClick={() => onChange({ mode })}
            data-board-view={mode}
          >
            {label}
          </CButton>
        ))}
      </CButtonGroup>
      <CFormSwitch
        id={groupedId}
        label="Linhas por card pai"
        checked={view.grouped}
        disabled={view.mode !== 'board'}
        onChange={(event) => onChange({ grouped: event.target.checked })}
      />
      <CFormSwitch
        id={treeId}
        label="Lista em árvore"
        checked={view.tree}
        disabled={view.mode !== 'list'}
        onChange={(event) => onChange({ tree: event.target.checked })}
      />
    </div>
  );
}
