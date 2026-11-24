import { CFormInput, CFormSelect } from '@coreui/react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import type { BoardLane, BoardPerson } from '../model/board';
import {
  isValidKeyPrefix,
  normalizeKeyPrefix,
  suggestKeyPrefix,
} from '../model/config';
import { PeopleEditor } from './people-editor';

export interface BoardFormValues {
  readonly name: string;
  readonly keyPrefix: string;
  /** Só na configuração de um quadro existente. */
  readonly doneLaneId?: string;
  /** Só na configuração de um quadro existente. */
  readonly people?: readonly BoardPerson[];
}

export interface BoardFormDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly initial: BoardFormValues;
  /** O prefixo segue o nome enquanto não for editado. */
  readonly suggestPrefix?: boolean;
  /** Devolve o nome que vale, ou `null` quando ele está vazio ou repetido. */
  readonly validateName: (name: string) => string | null;
  /** Texto de apoio do campo do prefixo. */
  readonly prefixHelp?: string;
  /** Colunas do quadro; com elas, a janela também configura a coluna de conclusão e as pessoas. */
  readonly lanes?: readonly BoardLane[];
  readonly onSave: (values: BoardFormValues) => void;
  readonly onCancel: () => void;
  /** Conteúdo extra da janela, depois dos campos. */
  readonly children?: ReactNode;
}

/**
 * Nome e prefixo do código de um quadro, para criar um quadro novo ou configurar o aberto. Num quadro novo, o prefixo
 * acompanha o nome até a pessoa mexer nele.
 */
export function BoardFormDialog({
  visible,
  title,
  confirmLabel,
  initial,
  suggestPrefix = false,
  validateName,
  prefixHelp,
  lanes,
  onSave,
  onCancel,
  children,
}: Readonly<BoardFormDialogProps>) {
  const nameId = useId();
  const prefixId = useId();
  const [name, setName] = useState(initial.name);
  const [prefix, setPrefix] = useState(initial.keyPrefix);
  const [prefixEdited, setPrefixEdited] = useState(!suggestPrefix);
  const doneId = useId();
  const [doneLaneId, setDoneLaneId] = useState(initial.doneLaneId ?? '');
  const [people, setPeople] = useState(initial.people ?? []);
  const validName = validateName(name);
  const keyPrefix = normalizeKeyPrefix(prefix);
  const prefixValid = isValidKeyPrefix(keyPrefix);
  const nameInvalid = name.trim() !== '' && validName === null;

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (validName && prefixValid) {
      onSave(
        lanes
          ? {
              name: validName,
              keyPrefix,
              doneLaneId: doneLaneId || undefined,
              people,
            }
          : { name: validName, keyPrefix },
      );
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      title={title}
      confirmLabel={confirmLabel}
      confirmDisabled={!validName || !prefixValid}
      onConfirm={() => save()}
      onCancel={onCancel}
    >
      <form onSubmit={save} className="d-grid gap-3">
        <CFormInput
          id={nameId}
          label="Nome do quadro"
          value={name}
          invalid={nameInvalid}
          feedbackInvalid="Já existe um quadro com este nome."
          onChange={(event) => {
            setName(event.target.value);
            if (!prefixEdited) {
              setPrefix(suggestKeyPrefix(event.target.value));
            }
          }}
        />
        <CFormInput
          id={prefixId}
          label="Prefixo do código dos cards"
          value={prefix}
          maxLength={6}
          autoCapitalize="characters"
          invalid={!prefixValid}
          feedbackInvalid="Use de 1 a 6 letras ou números, começando por letra."
          text={
            prefixValid
              ? `${prefixHelp ? `${prefixHelp} ` : ''}Exemplo: ${keyPrefix}-12.`
              : undefined
          }
          onChange={(event) => {
            setPrefix(event.target.value);
            setPrefixEdited(true);
          }}
        />
        {lanes ? (
          <>
            <CFormSelect
              id={doneId}
              label="Coluna de conclusão"
              text="O card pai mostra quantos filhos já estão nesta coluna."
              value={
                lanes.some((lane) => lane.id === doneLaneId) ? doneLaneId : ''
              }
              onChange={(event) => setDoneLaneId(event.target.value)}
            >
              <option value="">Nenhuma</option>
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.title}
                </option>
              ))}
            </CFormSelect>
            <PeopleEditor people={people} onChange={setPeople} />
          </>
        ) : null}
        {/* NOTE: sem botão de envio, o Enter nos campos não enviaria o formulário. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      {children}
    </ConfirmModal>
  );
}
