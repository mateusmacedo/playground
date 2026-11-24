import { cilPlus } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CFormInput } from '@coreui/react';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export interface InlineAddFormProps {
  /** Texto do botão que abre o campo. */
  readonly buttonLabel: string;
  /** Nome acessível do campo. */
  readonly inputLabel: string;
  /** Mantém o campo aberto depois de incluir, para a próxima inclusão. */
  readonly keepOpen?: boolean;
  readonly onAdd: (title: string) => void;
}

/** Botão que vira um campo de texto para incluir um item: Enter inclui e Esc ou "Cancelar" fecham. */
export function InlineAddForm({
  buttonLabel,
  inputLabel,
  keepOpen = false,
  onAdd,
}: Readonly<InlineAddFormProps>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function show() {
    flushSync(() => setOpen(true));
    inputRef.current?.focus();
  }

  function hide() {
    flushSync(() => {
      setOpen(false);
      setValue('');
    });
    buttonRef.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) {
      inputRef.current?.focus();
      return;
    }
    onAdd(value);
    if (keepOpen) {
      setValue('');
      inputRef.current?.focus();
      return;
    }
    hide();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // NOTE: dentro do painel de detalhes, o Esc fecha só o campo, não o painel.
      event.preventDefault();
      event.stopPropagation();
      hide();
    }
  }

  if (!open) {
    return (
      <CButton
        ref={buttonRef}
        type="button"
        color="secondary"
        variant="ghost"
        size="sm"
        className="w-100 text-start"
        onClick={show}
      >
        <CIcon icon={cilPlus} aria-hidden="true" className="me-1" />
        {buttonLabel}
      </CButton>
    );
  }

  return (
    <form className="d-grid gap-2" onSubmit={submit}>
      <CFormInput
        ref={inputRef}
        size="sm"
        aria-label={inputLabel}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="d-flex gap-2">
        <CButton type="submit" color="primary" size="sm">
          Adicionar
        </CButton>
        <CButton
          type="button"
          color="secondary"
          variant="ghost"
          size="sm"
          onClick={hide}
        >
          Cancelar
        </CButton>
      </div>
    </form>
  );
}
