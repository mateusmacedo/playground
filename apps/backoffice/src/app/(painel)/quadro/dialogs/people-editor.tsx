import { CButton, CFormInput } from '@coreui/react';
import { useId, useState } from 'react';

import type { BoardPerson } from '../model/board';
import { addPerson, validPersonName } from '../model/people';

export interface PeopleEditorProps {
  readonly people: readonly BoardPerson[];
  readonly onChange: (people: readonly BoardPerson[]) => void;
}

/** Pessoas do quadro, para escolher o responsável dos cards: acrescentar e tirar. */
export function PeopleEditor({
  people,
  onChange,
}: Readonly<PeopleEditorProps>) {
  const headingId = useId();
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const repeated =
    draft.trim() !== '' && !validPersonName({ people, name: draft });

  function add() {
    const next = addPerson({ people, name: draft });
    if (next !== people) {
      onChange(next);
      setDraft('');
    }
  }

  return (
    <fieldset aria-labelledby={headingId}>
      <legend id={headingId} className="fs-6 fw-semibold">
        Pessoas do quadro
      </legend>
      {people.length > 0 ? (
        <ul className="list-unstyled d-grid gap-1 mb-2">
          {people.map((person) => (
            <li key={person.id} className="d-flex align-items-center gap-2">
              <span className="flex-grow-1">{person.name}</span>
              <CButton
                type="button"
                color="danger"
                variant="ghost"
                size="sm"
                aria-label={`Tirar ${person.name} do quadro`}
                onClick={() =>
                  onChange(people.filter((item) => item.id !== person.id))
                }
              >
                Tirar
              </CButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small text-body-secondary mb-2">
          Nenhuma pessoa cadastrada.
        </p>
      )}
      <div className="d-flex gap-2">
        <CFormInput
          id={inputId}
          size="sm"
          aria-label="Nome da nova pessoa"
          placeholder="Nome"
          value={draft}
          invalid={repeated}
          feedbackInvalid="Essa pessoa já está no quadro."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // NOTE: o Enter aqui acrescenta a pessoa, sem enviar a janela inteira.
              event.preventDefault();
              add();
            }
          }}
        />
        <CButton
          type="button"
          color="secondary"
          variant="outline"
          size="sm"
          className="text-nowrap"
          disabled={!validPersonName({ people, name: draft })}
          onClick={add}
        >
          Adicionar pessoa
        </CButton>
      </div>
      <p className="small text-body-secondary mt-1 mb-0">
        Quem sai do quadro deixa de ser responsável pelos cards dele.
      </p>
    </fieldset>
  );
}
