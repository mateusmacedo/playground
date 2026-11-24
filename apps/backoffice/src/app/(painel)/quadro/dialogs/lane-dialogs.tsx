import { CFormInput, CFormSelect } from '@coreui/react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';

import type { BoardLane } from '../model/board';

/** Lê o campo do limite: vazio tira o limite, inteiro positivo vale e o resto é `null` (inválido). */
function parseLimit(value: string): number | undefined | null {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  const limit = Number(text);
  return Number.isInteger(limit) && limit > 0 ? limit : null;
}

export function LaneLimitDialog({
  visible,
  lane,
  onSave,
  onCancel,
  children,
}: Readonly<{
  visible: boolean;
  lane: BoardLane;
  onSave: (limit: number | undefined) => void;
  onCancel: () => void;
  /** Conteúdo extra da janela, depois do campo. */
  children?: ReactNode;
}>) {
  const [value, setValue] = useState(lane.wipLimit?.toString() ?? '');
  const inputId = useId();
  const limit = parseLimit(value);

  function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (limit !== null) {
      onSave(limit);
    }
  }

  return (
    <ConfirmModal
      visible={visible}
      title={`Limite da coluna ${lane.title}`}
      confirmLabel="Salvar"
      confirmDisabled={limit === null}
      onConfirm={() => save()}
      onCancel={onCancel}
    >
      <form onSubmit={save}>
        <p>
          Passar do limite só destaca a coluna, sem impedir o movimento dos
          cards. Deixe vazio para tirar o limite.
        </p>
        <CFormInput
          id={inputId}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          label="Máximo de cards"
          value={value}
          invalid={limit === null}
          feedbackInvalid="Use um número inteiro maior que zero."
          onChange={(event) => setValue(event.target.value)}
        />
      </form>
      {children}
    </ConfirmModal>
  );
}

/** Coluna que recebe os cards por padrão: a vizinha da esquerda, ou a da direita quando a coluna é a primeira. */
function defaultDestination(params: {
  readonly lanes: readonly BoardLane[];
  readonly laneId: string;
}): string {
  const index = params.lanes.findIndex((lane) => lane.id === params.laneId);
  const neighbor = params.lanes[index - 1] ?? params.lanes[index + 1];
  return neighbor?.id ?? '';
}

export function RemoveLaneDialog({
  visible,
  lane,
  lanes,
  onConfirm,
  onCancel,
  children,
}: Readonly<{
  visible: boolean;
  lane: BoardLane;
  lanes: readonly BoardLane[];
  onConfirm: (change: { laneId: string; moveCardsTo?: string }) => void;
  onCancel: () => void;
  /** Conteúdo extra da janela, depois do texto. */
  children?: ReactNode;
}>) {
  const [destination, setDestination] = useState(() =>
    defaultDestination({ lanes, laneId: lane.id }),
  );
  const selectId = useId();
  const others = lanes.filter((candidate) => candidate.id !== lane.id);
  const count = lane.cards.length;

  return (
    <ConfirmModal
      visible={visible}
      title={`Excluir a coluna ${lane.title}`}
      confirmLabel="Excluir"
      confirmColor="danger"
      onConfirm={() =>
        onConfirm({
          laneId: lane.id,
          moveCardsTo: count > 0 ? destination : undefined,
        })
      }
      onCancel={onCancel}
    >
      {count === 0 ? (
        <p className="mb-0">A coluna está vazia e sai do quadro.</p>
      ) : (
        <>
          <p>
            {count === 1
              ? 'O card desta coluna vai para o fim da coluna escolhida.'
              : `Os ${count} cards desta coluna vão para o fim da coluna escolhida.`}
          </p>
          <CFormSelect
            id={selectId}
            label="Mover os cards para"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            {others.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </CFormSelect>
        </>
      )}
      {children}
    </ConfirmModal>
  );
}
