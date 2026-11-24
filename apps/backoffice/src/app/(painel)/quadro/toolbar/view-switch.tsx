import { CButton, CButtonGroup, CFormSwitch } from '@coreui/react';
import { useId } from 'react';

import type { BoardView } from '../use-board-view';

export interface ViewSwitchProps {
  readonly view: BoardView;
  readonly onChange: (change: Partial<BoardView>) => void;
}

/** Troca entre o quadro e a lista, e liga as linhas por card pai no quadro. */
export function ViewSwitch({ view, onChange }: Readonly<ViewSwitchProps>) {
  const groupedId = useId();
  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <CButtonGroup size="sm" role="group" aria-label="Visão">
        <CButton
          type="button"
          color="secondary"
          variant={view.mode === 'board' ? undefined : 'outline'}
          aria-pressed={view.mode === 'board'}
          onClick={() => onChange({ mode: 'board' })}
        >
          Quadro
        </CButton>
        <CButton
          type="button"
          color="secondary"
          variant={view.mode === 'list' ? undefined : 'outline'}
          aria-pressed={view.mode === 'list'}
          onClick={() => onChange({ mode: 'list' })}
        >
          Lista
        </CButton>
      </CButtonGroup>
      <CFormSwitch
        id={groupedId}
        label="Linhas por card pai"
        checked={view.grouped}
        disabled={view.mode !== 'board'}
        onChange={(event) => onChange({ grouped: event.target.checked })}
      />
    </div>
  );
}
