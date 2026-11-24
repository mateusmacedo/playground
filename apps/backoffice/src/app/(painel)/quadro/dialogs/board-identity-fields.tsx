import { CFormInput } from '@coreui/react';
import { useId } from 'react';

export interface BoardIdentityFieldsProps {
  readonly name: string;
  /** O nome digitado já é de outro quadro. */
  readonly nameTaken: boolean;
  readonly prefix: string;
  readonly prefixValid: boolean;
  /** Texto de apoio do prefixo, mostrado enquanto ele é válido. */
  readonly prefixHelp: string;
  readonly onNameChange: (name: string) => void;
  readonly onPrefixChange: (prefix: string) => void;
}

/** O que identifica o quadro: o nome e o prefixo do código dos cards. */
export function BoardIdentityFields({
  name,
  nameTaken,
  prefix,
  prefixValid,
  prefixHelp,
  onNameChange,
  onPrefixChange,
}: Readonly<BoardIdentityFieldsProps>) {
  const nameId = useId();
  const prefixId = useId();

  return (
    <>
      <CFormInput
        id={nameId}
        label="Nome do quadro"
        value={name}
        invalid={nameTaken}
        feedbackInvalid="Já existe um quadro com este nome."
        onChange={(event) => onNameChange(event.target.value)}
      />
      <CFormInput
        id={prefixId}
        label="Prefixo do código dos cards"
        value={prefix}
        maxLength={6}
        autoCapitalize="characters"
        invalid={!prefixValid}
        feedbackInvalid="Use de 1 a 6 letras ou números, começando por letra."
        text={prefixValid ? prefixHelp : undefined}
        onChange={(event) => onPrefixChange(event.target.value)}
      />
    </>
  );
}
