import { CButton, CFormSelect } from '@coreui/react';
import { type FormEvent, type RefObject, useId, useState } from 'react';

import type { BoardCard } from '../model/board';

/** Card que pode passar a bloquear o card aberto. */
export interface BlockerCandidate {
  readonly card: BoardCard;
  readonly laneTitle: string | undefined;
}

export interface BlockerAddFormProps {
  readonly candidates: readonly BlockerCandidate[];
  /** O campo, para quem monta a seção levar o foco a ele quando um bloqueador entra na lista ou sai dela. */
  readonly selectRef: RefObject<HTMLSelectElement | null>;
  /** Devolve o motivo da recusa, ou `undefined` quando o quadro aceitou; quem aceita cuida do foco. */
  readonly onAdd: (blocker: BoardCard) => string | undefined;
}

/** Campo que escolhe o novo bloqueador entre os cards que podem bloquear o card aberto, com a recusa do quadro. */
export function BlockerAddForm({
  candidates,
  selectRef,
  onAdd,
}: Readonly<BlockerAddFormProps>) {
  const selectId = useId();
  const [selected, setSelected] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  // NOTE: o card escolhido pode sair do quadro, ou passar a fechar um ciclo, antes de ser adicionado.
  const chosen = candidates.find(({ card }) => card.id === selected)?.card;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) {
      return;
    }
    const reason = onAdd(chosen);
    setRefusal(reason ?? null);
    if (reason === undefined) {
      setSelected('');
    }
  }

  if (candidates.length === 0) {
    return (
      <p className="small text-body-secondary mb-0">
        Nenhum outro card pode bloquear este.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="d-flex align-items-end gap-2">
        <div className="flex-grow-1">
          <CFormSelect
            ref={selectRef}
            id={selectId}
            size="sm"
            label="Novo bloqueador"
            value={chosen?.id ?? ''}
            onChange={(event) => {
              setSelected(event.target.value);
              setRefusal(null);
            }}
          >
            <option value="">Escolha um card</option>
            {candidates.map(({ card, laneTitle }) => (
              <option key={card.id} value={card.id}>
                {card.title} ({laneTitle})
              </option>
            ))}
          </CFormSelect>
        </div>
        <CButton type="submit" color="primary" size="sm" disabled={!chosen}>
          Adicionar bloqueador
        </CButton>
      </div>
      {refusal ? (
        <p role="alert" className="small text-danger mb-0 mt-1">
          {refusal}
        </p>
      ) : null}
    </form>
  );
}
