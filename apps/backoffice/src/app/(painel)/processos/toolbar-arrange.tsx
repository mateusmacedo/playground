import { cilLayers } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CButton,
  CButtonGroup,
  CDropdown,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react';

import type { AlignMode, DistributeAxis } from './model/arrange';

const ALIGN_OPTIONS: readonly { mode: AlignMode; label: string }[] = [
  { mode: 'left', label: 'Alinhar à esquerda' },
  { mode: 'center', label: 'Centralizar na horizontal' },
  { mode: 'right', label: 'Alinhar à direita' },
  { mode: 'top', label: 'Alinhar ao topo' },
  { mode: 'middle', label: 'Centralizar na vertical' },
  { mode: 'bottom', label: 'Alinhar à base' },
];

const DISTRIBUTE_OPTIONS: readonly { axis: DistributeAxis; label: string }[] = [
  { axis: 'horizontal', label: 'Distribuir na horizontal' },
  { axis: 'vertical', label: 'Distribuir na vertical' },
];

export interface ArrangeGroupProps {
  readonly selectedNodes: number;
  readonly isEmpty: boolean;
  readonly onAlign: (mode: AlignMode) => void;
  readonly onDistribute: (axis: DistributeAxis) => void;
  readonly onAutoLayout: () => void;
}

/** Organizar: alinhar (dois blocos ou mais), distribuir (três ou mais) e layout automático, cada um num passo. */
export function ArrangeGroup({
  selectedNodes,
  isEmpty,
  onAlign,
  onDistribute,
  onAutoLayout,
}: Readonly<ArrangeGroupProps>) {
  const canAlign = selectedNodes >= 2;
  const canDistribute = selectedNodes >= 3;
  return (
    <CButtonGroup role="group" aria-label="Organizar" size="sm">
      <CDropdown variant="btn-group">
        <CDropdownToggle
          color="secondary"
          variant="outline"
          size="sm"
          disabled={!canAlign}
        >
          Alinhar
        </CDropdownToggle>
        <CDropdownMenu>
          <CDropdownHeader>Alinhar a seleção</CDropdownHeader>
          {ALIGN_OPTIONS.map((option) => (
            <CDropdownItem
              key={option.mode}
              as="button"
              onClick={() => onAlign(option.mode)}
            >
              {option.label}
            </CDropdownItem>
          ))}
          <CDropdownHeader>Distribuir a seleção</CDropdownHeader>
          {DISTRIBUTE_OPTIONS.map((option) => (
            <CDropdownItem
              key={option.axis}
              as="button"
              disabled={!canDistribute}
              onClick={() => onDistribute(option.axis)}
            >
              {option.label}
            </CDropdownItem>
          ))}
        </CDropdownMenu>
      </CDropdown>
      <CButton
        color="secondary"
        variant="outline"
        disabled={isEmpty}
        onClick={onAutoLayout}
      >
        <CIcon icon={cilLayers} aria-hidden="true" className="me-1" />
        Layout automático
      </CButton>
    </CButtonGroup>
  );
}
