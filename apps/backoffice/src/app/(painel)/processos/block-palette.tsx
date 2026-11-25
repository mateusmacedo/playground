import { cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { type DragEvent, useId } from 'react';

import {
  BLOCK_CATEGORIES,
  BLOCK_SPECS,
  type BlockKind,
  type BlockSpec,
} from './model/blocks';

/** Tipo do dado no arraste da biblioteca para o canvas; o valor é o tipo do bloco. */
export const BLOCK_DRAG_TYPE = 'application/x-process-block';

interface StartBlockDragParams {
  readonly event: DragEvent<HTMLElement>;
  readonly kind: BlockKind;
}

function startBlockDrag({ event, kind }: Readonly<StartBlockDragParams>) {
  event.dataTransfer.setData(BLOCK_DRAG_TYPE, kind);
  event.dataTransfer.effectAllowed = 'copy';
}

export interface BlockPaletteProps {
  readonly onAdd: (kind: BlockKind) => void;
}

interface PaletteItemProps {
  readonly spec: BlockSpec;
  readonly onAdd: (kind: BlockKind) => void;
}

function PaletteItem({ spec, onAdd }: Readonly<PaletteItemProps>) {
  return (
    <li
      className={`process-palette-item process-palette-item--${spec.kind}`}
      draggable
      onDragStart={(event) => startBlockDrag({ event, kind: spec.kind })}
    >
      <span className="flex-grow-1">
        <span className="d-block fw-semibold">{spec.label}</span>
        <span className="d-block small text-body-secondary">{spec.hint}</span>
      </span>
      <button
        type="button"
        className="btn btn-sm btn-ghost-primary"
        aria-label={`Inserir ${spec.label}`}
        onClick={() => onAdd(spec.kind)}
      >
        <CIcon icon={cilPlus} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Biblioteca de blocos, agrupada por categoria. O item inteiro é arrastável, e o botão "+" insere no centro do canvas,
 * que é o caminho pelo teclado. O arraste fica no item, e não no botão, porque o Firefox não arrasta elemento `button`.
 */
export function BlockPalette({ onAdd }: Readonly<BlockPaletteProps>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="h6">
        Blocos
      </h2>
      <p className="small text-body-secondary">
        Arraste para o canvas ou use o + para inserir no centro.
      </p>
      {BLOCK_CATEGORIES.map(({ category, label }) => (
        <div key={category} className="mb-3">
          <h3 className="process-palette__group">{label}</h3>
          <ul className="list-unstyled d-grid gap-2 mb-0" aria-label={label}>
            {BLOCK_SPECS.filter((spec) => spec.category === category).map(
              (spec) => (
                <PaletteItem key={spec.kind} spec={spec} onAdd={onAdd} />
              ),
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}
