import type { Board, BoardPerson, BoardRules } from './board';
import { setDoneLane, setKeyPrefix } from './config';
import { setPeople } from './people';
import { setRules } from './rules';

function samePeople(
  a: readonly BoardPerson[],
  b: readonly BoardPerson[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (person, index) =>
        person.id === b[index]?.id && person.name === b[index]?.name,
    )
  );
}

export interface ConfigureBoardParams {
  readonly board: Board;
  readonly keyPrefix?: string;
  /** `null` tira a coluna de conclusão. */
  readonly doneLaneId?: string | null;
  readonly people?: readonly BoardPerson[];
  /** O conjunto inteiro das regras: a que não vier ligada fica desligada. */
  readonly rules?: BoardRules;
}

/**
 * Aplica a janela de configuração de uma vez, para valer como um passo só do desfazer. Campo ausente fica como está;
 * nada mudando, devolve o próprio `board`.
 */
export function configureBoard(params: ConfigureBoardParams): Board {
  const { board } = params;
  let config = board.config;
  if (params.keyPrefix !== undefined) {
    config = setKeyPrefix({ config, keyPrefix: params.keyPrefix });
  }
  if (params.doneLaneId !== undefined) {
    config = setDoneLane({
      config,
      laneIds: board.lanes.map((lane) => lane.id),
      doneLaneId: params.doneLaneId ?? undefined,
    });
  }
  if (params.rules !== undefined) {
    config = setRules({ config, rules: params.rules });
  }
  const next = config === board.config ? board : { ...board, config };
  return params.people && !samePeople(params.people, board.config.people ?? [])
    ? setPeople({ board: next, people: params.people })
    : next;
}
