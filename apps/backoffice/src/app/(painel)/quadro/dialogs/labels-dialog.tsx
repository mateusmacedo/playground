import { cilTrash } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import {
  CButton,
  CFormInput,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { useId, useState } from 'react';

import { NewLabelForm } from '../details/new-label-form';
import type { BoardLabel, LabelColor } from '../model/board';
import { LABEL_COLORS } from '../model/labels';
import type { BoardCommands } from '../use-board';
import { OnClosed } from './on-closed';

type LabelCommands = Pick<
  BoardCommands,
  'createLabel' | 'updateLabel' | 'removeLabel'
>;

/** Uma etiqueta do catálogo; o nome tem rascunho para o campo poder ficar vazio enquanto a pessoa digita. */
function LabelRow({
  label,
  commands,
}: Readonly<{ label: BoardLabel; commands: LabelCommands }>) {
  const [draft, setDraft] = useState(label.name);
  const [seen, setSeen] = useState(label.name);
  if (seen !== label.name) {
    setSeen(label.name);
    setDraft(label.name);
  }
  return (
    <li className="d-flex flex-wrap align-items-center gap-2">
      <span className={`badge text-bg-${label.color}`} aria-hidden="true">
        {label.name}
      </span>
      <CFormInput
        size="sm"
        className="kanban-label-name"
        aria-label={`Nome da etiqueta ${label.name}`}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          commands.updateLabel({
            labelId: label.id,
            patch: { name: event.target.value },
          });
        }}
        onBlur={() => setDraft(label.name)}
      />
      <CFormSelect
        size="sm"
        className="w-auto"
        aria-label={`Cor da etiqueta ${label.name}`}
        value={label.color}
        onChange={(event) =>
          commands.updateLabel({
            labelId: label.id,
            patch: { color: event.target.value as LabelColor },
          })
        }
      >
        {LABEL_COLORS.map((option) => (
          <option key={option.color} value={option.color}>
            {option.name}
          </option>
        ))}
      </CFormSelect>
      <CButton
        type="button"
        color="danger"
        variant="ghost"
        size="sm"
        aria-label={`Excluir a etiqueta ${label.name}`}
        onClick={() => commands.removeLabel(label.id)}
      >
        <CIcon icon={cilTrash} aria-hidden="true" />
      </CButton>
    </li>
  );
}

/** Catálogo de etiquetas do quadro: renomear, trocar a cor, excluir (sai de todos os cards) e criar. */
export function LabelsDialog({
  visible,
  labels,
  commands,
  onClose,
  onClosed,
}: Readonly<{
  visible: boolean;
  labels: readonly BoardLabel[];
  commands: LabelCommands;
  onClose: () => void;
  /** A janela terminou de fechar. */
  onClosed: () => void;
}>) {
  const titleId = useId();
  return (
    <CModal
      visible={visible}
      aria-labelledby={titleId}
      onClose={() => {
        if (visible) {
          onClose();
        }
      }}
    >
      <CModalHeader>
        <CModalTitle id={titleId}>Etiquetas do quadro</CModalTitle>
      </CModalHeader>
      <CModalBody className="d-grid gap-3">
        {labels.length === 0 ? (
          <p className="mb-0 text-body-secondary">Nenhuma etiqueta ainda.</p>
        ) : (
          <ul className="list-unstyled d-grid gap-2 mb-0">
            {labels.map((label) => (
              <LabelRow key={label.id} label={label} commands={commands} />
            ))}
          </ul>
        )}
        <NewLabelForm
          onCreate={(label) => commands.createLabel(label) !== undefined}
        />
        <OnClosed
          onClosed={() => {
            if (!visible) {
              onClosed();
            }
          }}
        />
      </CModalBody>
      <CModalFooter>
        <CButton type="button" color="secondary" onClick={onClose}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
