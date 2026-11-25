import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { useId } from 'react';

import {
  BLOCK_CATEGORIES,
  BLOCK_SPECS,
  type BlockKind,
  type BlockSpec,
} from './model/blocks';

/** De onde veio o pedido: o + de uma conexão ou uma ligação solta numa área vazia. */
export type PickerRequest =
  | { readonly purpose: 'edge'; readonly edgeId: string }
  | {
      readonly purpose: 'output';
      readonly source: string;
      readonly sourceHandle: string | null;
      readonly position: { readonly x: number; readonly y: number };
    };

/** Tipos que cabem no pedido: todos recebem entrada; no meio de uma conexão, também precisam ter saída. */
export function compatibleSpecs(request: PickerRequest): BlockSpec[] {
  return BLOCK_SPECS.filter((spec) => {
    const acceptsInput = spec.input !== 'none';
    const continues = spec.output !== 'none';
    return request.purpose === 'edge'
      ? acceptsInput && continues
      : acceptsInput;
  });
}

export interface BlockPickerProps {
  readonly request: PickerRequest | null;
  readonly onPick: (kind: BlockKind) => void;
  readonly onCancel: () => void;
}

/** A biblioteca filtrada pelos tipos compatíveis, num diálogo: escolher cria e liga o bloco numa ação só. */
export function BlockPicker({
  request,
  onPick,
  onCancel,
}: Readonly<BlockPickerProps>) {
  const titleId = useId();
  const specs = request === null ? [] : compatibleSpecs(request);
  const title =
    request?.purpose === 'edge'
      ? 'Inserir bloco na conexão'
      : 'Criar bloco ligado à saída';
  return (
    <CModal
      visible={request !== null}
      onClose={onCancel}
      aria-labelledby={titleId}
      scrollable
    >
      <CModalHeader>
        <CModalTitle id={titleId}>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {BLOCK_CATEGORIES.map(({ category, label }) => {
          const inCategory = specs.filter((spec) => spec.category === category);
          if (inCategory.length === 0) {
            return null;
          }
          return (
            <section key={category} aria-label={label} className="mb-3">
              <h3 className="h6">{label}</h3>
              <div className="d-grid gap-2">
                {inCategory.map((spec) => (
                  <CButton
                    key={spec.kind}
                    color="secondary"
                    variant="outline"
                    className={`text-start process-palette-item--${spec.kind} process-picker-item`}
                    onClick={() => onPick(spec.kind)}
                  >
                    <span className="d-block fw-semibold">{spec.label}</span>
                    <span className="d-block small text-body-secondary">
                      {spec.hint}
                    </span>
                  </CButton>
                ))}
              </div>
            </section>
          );
        })}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onCancel}>
          Cancelar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
