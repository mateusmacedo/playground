import { type FormEvent, type ReactNode, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import type { BoardLane, BoardPerson } from '../model/board';
import {
  isValidKeyPrefix,
  normalizeKeyPrefix,
  suggestKeyPrefix,
} from '../model/config';
import { BoardIdentityFields } from './board-identity-fields';
import { DoneLaneField } from './done-lane-field';
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
  const [name, setName] = useState(initial.name);
  const [prefix, setPrefix] = useState(initial.keyPrefix);
  const [prefixEdited, setPrefixEdited] = useState(!suggestPrefix);
  const [doneLaneId, setDoneLaneId] = useState(initial.doneLaneId ?? '');
  const [people, setPeople] = useState(initial.people ?? []);

  const validName = validateName(name);
  const keyPrefix = normalizeKeyPrefix(prefix);
  const prefixValid = isValidKeyPrefix(keyPrefix);
  const canSave = validName !== null && prefixValid;
  const prefixExample = `Exemplo: ${keyPrefix}-12.`;

  function changeName(nextName: string) {
    setName(nextName);
    if (!prefixEdited) {
      setPrefix(suggestKeyPrefix(nextName));
    }
  }

  function changePrefix(nextPrefix: string) {
    setPrefix(nextPrefix);
    setPrefixEdited(true);
  }

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (validName === null || !prefixValid) {
      return;
    }
    if (lanes) {
      onSave({
        name: validName,
        keyPrefix,
        doneLaneId: doneLaneId || undefined,
        people,
      });
    } else {
      onSave({ name: validName, keyPrefix });
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      title={title}
      confirmLabel={confirmLabel}
      confirmDisabled={!canSave}
      onConfirm={() => save()}
      onCancel={onCancel}
    >
      <form onSubmit={save} className="d-grid gap-3">
        <BoardIdentityFields
          name={name}
          nameTaken={name.trim() !== '' && validName === null}
          prefix={prefix}
          prefixValid={prefixValid}
          prefixHelp={
            prefixHelp ? `${prefixHelp} ${prefixExample}` : prefixExample
          }
          onNameChange={changeName}
          onPrefixChange={changePrefix}
        />
        {lanes ? (
          <>
            <DoneLaneField
              lanes={lanes}
              doneLaneId={doneLaneId}
              onChange={setDoneLaneId}
            />
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
