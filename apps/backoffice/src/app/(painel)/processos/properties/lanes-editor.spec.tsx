import { fireEvent, render, screen } from '@testing-library/react';

import { LANE_WIDTH } from '../model/document';
import { LanesEditor } from './lanes-editor';

function commandsMock() {
  return { addLane: vi.fn(), renameLane: vi.fn(), moveLane: vi.fn() };
}

describe('LanesEditor', () => {
  it('cria, renomeia e reordena as raias', () => {
    const commands = commandsMock();
    render(
      <LanesEditor
        lanes={[
          { id: 'a', name: 'Vendas', width: LANE_WIDTH },
          { id: 'b', name: 'Financeiro', width: LANE_WIDTH },
        ]}
        commands={commands}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nome da raia 1'), {
      target: { value: 'Comercial' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Mover Financeiro para a esquerda' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar raia' }));

    expect(commands.renameLane).toHaveBeenCalledWith({
      laneId: 'a',
      name: 'Comercial',
    });
    expect(commands.moveLane).toHaveBeenCalledWith({
      laneId: 'b',
      direction: 'before',
    });
    expect(commands.addLane).toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: 'Mover Vendas para a esquerda',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('explica quando ainda não há raias', () => {
    render(<LanesEditor lanes={[]} commands={commandsMock()} />);

    expect(screen.getByText(/Sem raias/)).toBeTruthy();
  });
});
