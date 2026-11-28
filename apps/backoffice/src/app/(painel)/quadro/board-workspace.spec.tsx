import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { BoardWorkspace } from './board-workspace';
import { createBoard } from './model/board-state';
import { sampleLabels, sampleLanes } from './model/sample-board';
import { BOARD_STORAGE_KEY, serializeBoard } from './model/storage';
import {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  serializeBoards,
} from './model/workspace';

function renderWorkspace() {
  return render(
    <BoardWorkspace sampleLanes={sampleLanes} sampleLabels={sampleLabels} />,
  );
}

function boardSelect(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: 'Quadro' });
}

function addCard(laneTitle: string, title: string) {
  const lane = screen.getByRole('region', { name: laneTitle });
  fireEvent.click(within(lane).getByRole('button', { name: 'Adicionar card' }));
  const input = within(lane).getByRole('textbox', {
    name: `Título do novo card em ${laneTitle}`,
  });
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input);
}

async function createBoardNamed(name: string, prefix?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Novo quadro' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Novo quadro',
  });
  fireEvent.change(within(dialog).getByLabelText('Nome do quadro'), {
    target: { value: name },
  });
  if (prefix !== undefined) {
    fireEvent.change(
      within(dialog).getByLabelText('Prefixo do código dos cards'),
      { target: { value: prefix } },
    );
  }
  // NOTE: o quadro novo lê o que foi gravado nele logo depois de montar, e a leitura é assíncrona: o `act` espera
  // por ela.
  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar' }));
  });
}

function storageEvent(key: string, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
}

describe('BoardWorkspace: vários quadros', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/quadro');
  });

  afterEach(() => localStorage.clear());

  it('abre o quadro principal e o põe no endereço', async () => {
    renderWorkspace();

    expect(
      await screen.findByRole('region', { name: 'Em andamento' }),
    ).toBeTruthy();
    expect(boardSelect().value).toBe('board-1');
    await waitFor(() => expect(window.location.search).toBe('?quadro=board-1'));
    expect(screen.getByText('QD-1')).toBeTruthy();
  });

  it('cria um quadro com o prefixo sugerido e colunas vazias', async () => {
    renderWorkspace();
    await screen.findByRole('region', { name: 'Em andamento' });

    await createBoardNamed('Operações de TI');

    await waitFor(() => expect(boardSelect().value).toBe('board-2'));
    expect(
      screen.getByRole('option', { name: 'Operações de TI' }),
    ).toBeTruthy();
    expect(screen.queryByText('QD-1')).toBeNull();
    addCard('A fazer', 'Trocar servidor');
    expect(await screen.findByText('ODT-1')).toBeTruthy();
    expect(localStorage.getItem(boardStorageKey('board-2'))).toContain(
      'Trocar servidor',
    );
    expect(
      screen.queryByRole('button', { name: 'Restaurar exemplo' }),
    ).toBeNull();
  });

  it('troca de quadro sem misturar os cards e tira o card do endereço', async () => {
    renderWorkspace();
    await screen.findByRole('region', { name: 'Em andamento' });
    await createBoardNamed('RH', 'RH');
    await waitFor(() => expect(window.location.search).toBe('?quadro=board-2'));
    window.history.replaceState(null, '', '/quadro?quadro=board-2&card=RH-1');

    fireEvent.change(boardSelect(), { target: { value: 'board-1' } });

    expect(await screen.findByText('QD-1')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toBe('?quadro=board-1'));
  });

  it('configura nome e prefixo do quadro aberto', async () => {
    renderWorkspace();
    await screen.findByText('QD-1');

    fireEvent.click(screen.getByRole('button', { name: 'Configurar quadro' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Configurar quadro',
    });
    const prefix = within(dialog).getByLabelText('Prefixo do código dos cards');
    fireEvent.change(prefix, { target: { value: '1x' } });
    expect(
      within(dialog).getByRole('button', { name: 'Salvar' }),
    ).toHaveProperty('disabled', true);
    fireEvent.change(prefix, { target: { value: 'ops' } });
    fireEvent.change(within(dialog).getByLabelText('Nome do quadro'), {
      target: { value: 'Operação' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('OPS-1')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Operação' })).toBeTruthy();
    expect(localStorage.getItem(BOARDS_STORAGE_KEY)).toContain('Operação');
  });

  it('recusa nome repetido ao criar um quadro', async () => {
    renderWorkspace();
    await screen.findByText('QD-1');

    fireEvent.click(screen.getByRole('button', { name: 'Novo quadro' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Novo quadro',
    });
    fireEvent.change(within(dialog).getByLabelText('Nome do quadro'), {
      target: { value: 'quadro principal' },
    });

    expect(
      within(dialog).getByText('Já existe um quadro com este nome.'),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: 'Criar' }),
    ).toHaveProperty('disabled', true);
  });

  it('exclui o quadro aberto e volta ao vizinho', async () => {
    renderWorkspace();
    await screen.findByText('QD-1');
    await createBoardNamed('Temporário', 'TMP');
    await waitFor(() => expect(boardSelect().value).toBe('board-2'));

    fireEvent.click(screen.getByRole('button', { name: 'Excluir quadro' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Excluir o quadro Temporário',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(boardSelect().value).toBe('board-1'));
    expect(localStorage.getItem(boardStorageKey('board-2'))).toBeNull();
    expect(screen.queryByRole('option', { name: 'Temporário' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir quadro' })).toBeNull();
  });

  it('abre o quadro pedido no endereço', async () => {
    localStorage.setItem(
      BOARDS_STORAGE_KEY,
      serializeBoards([
        { id: 'board-1', name: 'Principal' },
        { id: 'board-2', name: 'Jurídico' },
      ]),
    );
    localStorage.setItem(
      boardStorageKey('board-2'),
      serializeBoard(
        createBoard({
          lanes: [{ id: 'l', title: 'Petições', cards: [] }],
          config: { keyPrefix: 'JUR' },
        }),
      ),
    );
    window.history.replaceState(null, '', '/quadro?quadro=board-2');

    renderWorkspace();

    expect(
      await screen.findByRole('region', { name: 'Petições' }),
    ).toBeTruthy();
    expect(boardSelect().value).toBe('board-2');
  });

  it('acompanha o que outra aba muda no quadro e na lista', async () => {
    renderWorkspace();
    await screen.findByText('QD-1');

    storageEvent(
      BOARD_STORAGE_KEY,
      serializeBoard(
        createBoard({
          lanes: [
            {
              id: 'lane-1',
              title: 'Vinda da outra aba',
              cards: [{ id: 'card-1', title: 'Novo' }],
            },
          ],
        }),
      ),
    );
    expect(
      await screen.findByRole('region', { name: 'Vinda da outra aba' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Desfazer/ })).toHaveProperty(
      'disabled',
      true,
    );

    storageEvent(
      BOARDS_STORAGE_KEY,
      serializeBoards([
        { id: 'board-1', name: 'Principal renomeado' },
        { id: 'board-7', name: 'Criado na outra aba' },
      ]),
    );
    expect(
      await screen.findByRole('option', { name: 'Criado na outra aba' }),
    ).toBeTruthy();
    expect(boardSelect().value).toBe('board-1');

    storageEvent(BOARD_STORAGE_KEY, '{quebrado');
    expect(
      screen.getByRole('region', { name: 'Vinda da outra aba' }),
    ).toBeTruthy();
  });

  it('vai para o vizinho quando outra aba exclui o quadro aberto', async () => {
    renderWorkspace();
    await screen.findByText('QD-1');
    await createBoardNamed('Efêmero', 'EF');
    await waitFor(() => expect(boardSelect().value).toBe('board-2'));

    storageEvent(
      BOARDS_STORAGE_KEY,
      serializeBoards([{ id: 'board-1', name: 'Quadro principal' }]),
    );

    await waitFor(() => expect(boardSelect().value).toBe('board-1'));
    storageEvent(BOARDS_STORAGE_KEY, 'lixo');
    expect(boardSelect().value).toBe('board-1');
  });
});
