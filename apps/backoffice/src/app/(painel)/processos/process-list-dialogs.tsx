import {
  CButton,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react';
import { type ReactNode, useId } from 'react';

import type {
  ProcessDefinition,
  ProcessVersion,
} from '@/shared/process/catalog';

interface ListModalProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

function ListModal({ title, onClose, children }: Readonly<ListModalProps>) {
  const titleId = useId();
  return (
    <CModal visible aria-labelledby={titleId} onClose={onClose}>
      <CModalHeader>
        <CModalTitle id={titleId}>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>{children}</CModalBody>
      <CModalFooter>
        <CButton color="secondary" type="button" onClick={onClose}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

export interface ArchivedProcessesDialogProps {
  readonly archived: readonly ProcessDefinition[];
  readonly onRestore: (definitionId: string) => void;
  readonly onClose: () => void;
}

/** Processos arquivados, cada um com "Restaurar", que o devolve ao seletor. */
export function ArchivedProcessesDialog({
  archived,
  onRestore,
  onClose,
}: Readonly<ArchivedProcessesDialogProps>) {
  return (
    <ListModal title="Processos arquivados" onClose={onClose}>
      {archived.length === 0 ? (
        <p className="mb-0 text-body-secondary">Nenhum processo arquivado.</p>
      ) : (
        <CListGroup>
          {archived.map((definition) => (
            <CListGroupItem
              key={definition.id}
              className="d-flex align-items-center gap-2"
            >
              <span className="me-auto">{definition.name}</span>
              <CButton
                color="primary"
                variant="outline"
                size="sm"
                type="button"
                aria-label={`Restaurar ${definition.name}`}
                onClick={() => onRestore(definition.id)}
              >
                Restaurar
              </CButton>
            </CListGroupItem>
          ))}
        </CListGroup>
      )}
    </ListModal>
  );
}

/** Data e hora da publicação, no formato do Brasil. */
export function publishedAtText(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export interface ProcessVersionsDialogProps {
  readonly processName: string;
  readonly versions: readonly ProcessVersion[];
  readonly onOpenVersion: (version: ProcessVersion) => void;
  readonly onClose: () => void;
}

/** Versões publicadas do processo, da mais nova para a mais antiga, com "Abrir como rascunho". */
export function ProcessVersionsDialog({
  processName,
  versions,
  onOpenVersion,
  onClose,
}: Readonly<ProcessVersionsDialogProps>) {
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  return (
    <ListModal title={`Versões de ${processName}`} onClose={onClose}>
      <CListGroup>
        {ordered.map((version) => (
          <CListGroupItem
            key={version.version}
            className="d-flex flex-wrap align-items-center gap-2"
          >
            <span className="me-auto">
              <strong>{`Versão ${version.version}`}</strong>{' '}
              <span className="small text-body-secondary">
                {`publicada em ${publishedAtText(version.publishedAt)}`}
              </span>
            </span>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              type="button"
              aria-label={`Abrir a versão ${version.version} como rascunho`}
              onClick={() => onOpenVersion(version)}
            >
              Abrir como rascunho
            </CButton>
          </CListGroupItem>
        ))}
      </CListGroup>
    </ListModal>
  );
}
