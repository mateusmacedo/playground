import { fireEvent, render, screen } from '@testing-library/react';

import type { Announce } from './board-notices';
import { BoardViews } from './board-views';
import type { BoardLane } from './model/board';
import { useBoardScreen } from './use-board-screen';

const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [{ id: 'a', title: 'Card A' }] },
];

interface RefusingBoardProps {
  readonly announce: Announce;
}

/** As visões sobre um quadro que recusa toda criação de card e de coluna. */
function RefusingBoard({ announce }: Readonly<RefusingBoardProps>) {
  const boardScreen = useBoardScreen({ initialLanes: lanes });
  return (
    <BoardViews
      screen={{
        ...boardScreen,
        commands: {
          ...boardScreen.commands,
          addCard: () => undefined,
          addLane: () => undefined,
        },
        feedback: { ...boardScreen.feedback, announce },
      }}
    />
  );
}

interface AddParams {
  /** Texto do botão que abre o campo. */
  readonly button: string;
  /** Nome acessível do campo. */
  readonly field: string;
  readonly text: string;
}

function add(params: AddParams) {
  fireEvent.click(screen.getByRole('button', { name: params.button }));
  const input = screen.getByRole('textbox', { name: params.field });
  fireEvent.change(input, { target: { value: params.text } });
  fireEvent.submit(input);
}

describe('BoardViews', () => {
  it('não anuncia o card que o quadro recusou criar', () => {
    const announce = vi.fn();
    render(<RefusingBoard announce={announce} />);

    add({
      button: 'Adicionar card',
      field: 'Título do novo card em A fazer',
      text: 'Card novo',
    });

    expect(announce).not.toHaveBeenCalled();
  });

  it('não anuncia a coluna que o quadro recusou criar', () => {
    const announce = vi.fn();
    render(<RefusingBoard announce={announce} />);

    add({
      button: 'Adicionar coluna',
      field: 'Nome da nova coluna',
      text: 'Coluna nova',
    });

    expect(announce).not.toHaveBeenCalled();
  });
});
