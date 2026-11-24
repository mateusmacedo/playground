import { cilPlus, cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormSelect } from '@coreui/react';
import { type Ref, useId } from 'react';

import type { BoardSummary } from './model/workspace';

export interface BoardSwitcherProps {
  readonly boards: readonly BoardSummary[];
  readonly activeId: string;
  /** Vai no seletor, que recebe o foco quando uma janela do quadro fecha. */
  readonly selectRef: Ref<HTMLSelectElement>;
  readonly onSelect: (boardId: string) => void;
  readonly onNew: () => void;
  readonly onRemove: () => void;
}

/** Escolha do quadro aberto e os botões de criar e excluir quadro; o último quadro não pode ser excluído. */
export function BoardSwitcher({
  boards,
  activeId,
  selectRef,
  onSelect,
  onNew,
  onRemove,
}: Readonly<BoardSwitcherProps>) {
  const selectId = useId();
  const canRemove = boards.length > 1;

  return (
    <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
      <div>
        <CFormSelect
          ref={selectRef}
          id={selectId}
          label="Quadro"
          size="sm"
          value={activeId}
          onChange={(event) => onSelect(event.target.value)}
        >
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </CFormSelect>
      </div>
      <CButton
        type="button"
        color="primary"
        variant="outline"
        size="sm"
        onClick={onNew}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        Novo quadro
      </CButton>
      {canRemove ? (
        <CButton
          type="button"
          color="danger"
          variant="outline"
          size="sm"
          onClick={onRemove}
        >
          <CIcon icon={cilTrash} aria-hidden="true" className="me-1" />
          Excluir quadro
        </CButton>
      ) : null}
    </div>
  );
}
