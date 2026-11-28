import { fireEvent, render, screen, within } from '@testing-library/react';

import type { Board } from '../model/board';
import { cardOf, processBoard } from '../model/process-test-data';
import { DependenciesSection } from './dependencies-section';

// C é bloqueado por B (pendente) e por E (concluído); B é bloqueado por A; D está solto.
function chainBoard(withoutDoneLane = false): Board {
  return processBoard({
    todo: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', blockedBy: ['a'] },
    ],
    doing: [
      { id: 'c', title: 'C', blockedBy: ['b', 'e'] },
      { id: 'd', title: 'D' },
    ],
    done: [{ id: 'e', title: 'E' }],
    withoutDoneLane,
  });
}

interface SetupParams {
  readonly board?: Board;
  readonly cardId?: string;
  /** Motivo com que o quadro recusa o novo bloqueador. */
  readonly refusal?: string;
  readonly silent?: boolean;
}

function setup(params: SetupParams = {}) {
  const board = params.board ?? chainBoard();
  const commands = {
    addBlocker: vi.fn(() => params.refusal),
    removeBlocker: vi.fn(),
  };
  const onOpenCard = vi.fn();
  const onAnnounce = vi.fn();
  render(
    <DependenciesSection
      card={cardOf({ board, cardId: params.cardId ?? 'c' })}
      board={board}
      commands={commands}
      onOpenCard={onOpenCard}
      onAnnounce={params.silent ? undefined : onAnnounce}
    />,
  );
  return { commands, onOpenCard, onAnnounce };
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Dependências' });
}

function listItems(name: string): string[] {
  const list = within(section()).getByRole('list', { name });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

function newBlocker(): HTMLSelectElement {
  return within(section()).getByLabelText(
    'Novo bloqueador',
  ) as HTMLSelectElement;
}

function addButton(): HTMLButtonElement {
  return within(section()).getByRole('button', {
    name: 'Adicionar bloqueador',
  }) as HTMLButtonElement;
}

describe('DependenciesSection', () => {
  it('lista os bloqueadores com a coluna e a situação de cada um', () => {
    setup();

    expect(listItems('Bloqueado por')).toEqual([
      'B (A fazer) Pendente',
      'E (Concluído) Concluído',
    ]);
    expect(
      within(section()).queryByText(/não tem coluna de conclusão/),
    ).toBeNull();
  });

  it('conta todo bloqueador como pendente quando o quadro não tem coluna de conclusão', () => {
    setup({ board: chainBoard(true) });

    expect(listItems('Bloqueado por')).toEqual([
      'B (A fazer) Pendente',
      'E (Concluído) Pendente',
    ]);
    expect(
      within(section()).getByText(
        'O quadro não tem coluna de conclusão: todo bloqueador conta como pendente.',
      ),
    ).toBeTruthy();
  });

  it('abre o bloqueador pelo título', () => {
    const { onOpenCard } = setup();

    fireEvent.click(within(section()).getByRole('button', { name: 'B' }));

    expect(onOpenCard).toHaveBeenCalledWith('b');
  });

  it('oferece só os cards que podem bloquear: sem o próprio card, os que já bloqueiam e o que fecharia um ciclo', () => {
    setup({ cardId: 'b' });

    const options = Array.from(newBlocker().options, (option) => option.text);
    expect(options).toEqual([
      'Escolha um card',
      'D (Em andamento)',
      'E (Concluído)',
    ]);
  });

  it('adiciona o bloqueador escolhido, avisa o leitor de tela e limpa o campo', () => {
    const { commands, onAnnounce } = setup();
    expect(addButton().disabled).toBe(true);

    fireEvent.change(newBlocker(), { target: { value: 'd' } });
    fireEvent.click(addButton());

    expect(commands.addBlocker).toHaveBeenCalledWith({
      cardId: 'c',
      blockerId: 'd',
    });
    expect(onAnnounce).toHaveBeenCalledWith('Card D passou a bloquear C.');
    expect(newBlocker().value).toBe('');
    expect(document.activeElement).toBe(newBlocker());
    expect(within(section()).queryByRole('alert')).toBeNull();
  });

  it('mostra a recusa do quadro como alerta, sem anunciar, e a tira quando outro card é escolhido', () => {
    const refusal =
      'O card D já depende de C: a dependência fecharia um ciclo.';
    const { onAnnounce } = setup({ refusal });

    fireEvent.change(newBlocker(), { target: { value: 'd' } });
    fireEvent.click(addButton());

    expect(within(section()).getByRole('alert').textContent).toBe(refusal);
    expect(newBlocker().value).toBe('d');
    expect(onAnnounce).not.toHaveBeenCalled();

    fireEvent.change(newBlocker(), { target: { value: 'a' } });
    expect(within(section()).queryByRole('alert')).toBeNull();
  });

  it('não adiciona nada sem um card escolhido', () => {
    const { commands } = setup();

    fireEvent.submit(newBlocker());

    expect(commands.addBlocker).not.toHaveBeenCalled();
  });

  it('remove o bloqueador, avisa o leitor de tela e leva o foco ao campo do novo bloqueador', () => {
    const { commands, onAnnounce } = setup();

    fireEvent.click(
      within(section()).getByRole('button', {
        name: 'Remover o bloqueador B',
      }),
    );

    expect(commands.removeBlocker).toHaveBeenCalledWith({
      cardId: 'c',
      blockerId: 'b',
    });
    expect(onAnnounce).toHaveBeenCalledWith('Card B deixou de bloquear C.');
    expect(document.activeElement).toBe(newBlocker());
  });

  it('muda as dependências em silêncio quando não recebe o anúncio', () => {
    const { commands } = setup({ silent: true });

    fireEvent.change(newBlocker(), { target: { value: 'd' } });
    fireEvent.click(addButton());
    fireEvent.click(
      within(section()).getByRole('button', {
        name: 'Remover o bloqueador E',
      }),
    );

    expect(commands.addBlocker).toHaveBeenCalledTimes(1);
    expect(commands.removeBlocker).toHaveBeenCalledTimes(1);
  });

  it('lista os cards que o card bloqueia, só para leitura, com o link de cada um', () => {
    const { onOpenCard } = setup({ cardId: 'b' });

    expect(listItems('Bloqueia')).toEqual(['C (Em andamento)']);
    const blocked = within(section()).getByRole('list', { name: 'Bloqueia' });
    expect(within(blocked).getAllByRole('button')).toHaveLength(1);

    fireEvent.click(within(blocked).getByRole('button', { name: 'C' }));
    expect(onOpenCard).toHaveBeenCalledWith('c');
  });

  it('diz quando o card não tem bloqueador nem bloqueia outro', () => {
    setup({ cardId: 'd' });

    expect(within(section()).getByText('Nenhum bloqueador.')).toBeTruthy();
    expect(
      within(section()).getByText('Este card não bloqueia nenhum outro.'),
    ).toBeTruthy();
  });

  it('diz quando nenhum outro card pode bloquear o card', () => {
    const board = processBoard({ todo: [{ id: 'a', title: 'A' }] });
    setup({ board, cardId: 'a' });

    expect(
      within(section()).getByText('Nenhum outro card pode bloquear este.'),
    ).toBeTruthy();
    expect(within(section()).queryByLabelText('Novo bloqueador')).toBeNull();
  });
});
