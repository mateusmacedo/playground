import { fireEvent, render, screen, within } from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import { MAX_ATTACHMENT_BYTES } from './model/attachments';
import type { BoardLane } from './model/board';

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'p', title: 'Pai' },
      { id: 'a', title: 'Filho A', parentId: 'p' },
    ],
  },
  {
    id: 'done',
    title: 'Concluído',
    cards: [{ id: 'b', title: 'Filho B', parentId: 'p' }],
  },
];

const settings = {
  name: 'Quadro',
  validateName: (name: string) => name.trim() || null,
  onRename: vi.fn(),
};

function cardItem(title: string): HTMLElement {
  return screen
    .getByRole('heading', { level: 3, name: title })
    .closest('li') as HTMLElement;
}

function openCard(title: string) {
  fireEvent.click(within(cardItem(title)).getByRole('button', { name: title }));
}

function panel() {
  return screen.getByRole('dialog', { name: 'Detalhes do card' });
}

async function configure(change: {
  readonly doneLane?: string;
  readonly people?: readonly string[];
}) {
  fireEvent.click(screen.getByRole('button', { name: 'Configurar quadro' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Configurar quadro',
  });
  if (change.doneLane !== undefined) {
    fireEvent.change(within(dialog).getByLabelText('Coluna de conclusão'), {
      target: { value: change.doneLane },
    });
  }
  for (const name of change.people ?? []) {
    const input = within(dialog).getByRole('textbox', {
      name: 'Nome da nova pessoa',
    });
    fireEvent.change(input, { target: { value: name } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
}

describe('KanbanBoard: coluna de conclusão e responsável', () => {
  it('mostra no pai quantos filhos estão na coluna de conclusão', async () => {
    render(<KanbanBoard initialLanes={lanes} settings={settings} />);
    expect(within(cardItem('Pai')).getByText('2 filhos')).toBeTruthy();

    await configure({ doneLane: 'done' });

    expect(
      within(cardItem('Pai')).getByText('1 de 2 filhos concluídos'),
    ).toBeTruthy();
    openCard('Pai');
    expect(
      within(panel()).getByText('(1 de 2 filhos concluídos)'),
    ).toBeTruthy();

    fireEvent.change(within(panel()).getByLabelText('Coluna'), {
      target: { value: 'done' },
    });
    openCard('Filho A');
    fireEvent.change(within(panel()).getByLabelText('Coluna'), {
      target: { value: 'done' },
    });
    expect(
      within(cardItem('Pai')).getByText('2 de 2 filhos concluídos'),
    ).toBeTruthy();
  });

  it('cadastra pessoas e define o responsável do card', async () => {
    render(<KanbanBoard initialLanes={lanes} settings={settings} />);
    openCard('Filho A');
    expect(
      within(panel()).getByText(
        'Cadastre as pessoas do quadro em "Configurar quadro".',
      ),
    ).toBeTruthy();

    await configure({ people: ['Ana Souza', 'Bruno', 'ana souza'] });
    const assignee = within(panel()).getByLabelText('Responsável');
    expect(
      within(assignee)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Ninguém', 'Ana Souza', 'Bruno']);

    fireEvent.change(within(panel()).getByLabelText('Responsável'), {
      target: { value: 'person-1' },
    });
    expect(
      within(cardItem('Filho A')).getByText('Responsável: Ana Souza'),
    ).toBeTruthy();
    expect(within(cardItem('Filho A')).getByText('AS')).toBeTruthy();
    expect(within(panel()).getByText('Responsável: Ana Souza.')).toBeTruthy();
  });

  it('tira o responsável quando a pessoa sai do quadro', async () => {
    render(<KanbanBoard initialLanes={lanes} settings={settings} />);
    await configure({ people: ['Ana Souza'] });
    openCard('Filho A');
    fireEvent.change(within(panel()).getByLabelText('Responsável'), {
      target: { value: 'person-1' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Configurar quadro' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Configurar quadro',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tirar Ana Souza do quadro' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      within(cardItem('Filho A')).queryByText('Responsável: Ana Souza'),
    ).toBeNull();
  });
});

describe('KanbanBoard: comentários e anexos', () => {
  it('comenta com o nome de quem está usando e exclui o comentário', () => {
    render(<KanbanBoard initialLanes={lanes} author="Ana" />);
    openCard('Filho A');
    const box = within(panel()).getByRole('textbox', {
      name: 'Novo comentário',
    });
    const send = within(panel()).getByRole('button', { name: 'Comentar' });
    expect(send).toHaveProperty('disabled', true);

    fireEvent.change(box, { target: { value: 'Primeira linha\nsegunda' } });
    fireEvent.click(send);

    const section = within(panel()).getByRole('region', {
      name: 'Comentários (1)',
    });
    expect(within(section).getByText('Ana')).toBeTruthy();
    expect(within(section).getByText(/Primeira linha/)).toBeTruthy();
    expect(within(cardItem('Filho A')).getByText('1 comentário')).toBeTruthy();

    fireEvent.change(box, { target: { value: 'Pelo atalho' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(
      within(panel()).getByRole('region', { name: 'Comentários (2)' }),
    ).toBeTruthy();

    fireEvent.click(
      within(panel()).getAllByRole('button', {
        name: 'Excluir o comentário de Ana',
      })[0] as HTMLElement,
    );
    expect(
      within(panel()).getByRole('region', { name: 'Comentários (1)' }),
    ).toBeTruthy();
  });

  it('anexa link e arquivo pequeno, recusa o grande e remove', async () => {
    render(<KanbanBoard initialLanes={lanes} />);
    openCard('Filho A');
    const link = within(panel()).getByRole('textbox', {
      name: 'Endereço do link',
    });
    const attach = within(panel()).getByRole('button', {
      name: 'Anexar link',
    });

    fireEvent.change(link, { target: { value: 'nada' } });
    expect(attach).toHaveProperty('disabled', true);
    fireEvent.change(link, { target: { value: 'https://exemplo.com/doc' } });
    fireEvent.change(
      within(panel()).getByRole('textbox', { name: 'Nome do link (opcional)' }),
      { target: { value: 'Contrato' } },
    );
    fireEvent.click(attach);

    const anchor = within(panel()).getByRole('link', { name: 'Contrato' });
    expect(anchor.getAttribute('href')).toBe('https://exemplo.com/doc');
    expect(within(cardItem('Filho A')).getByText('1 anexo')).toBeTruthy();
    expect(
      within(panel()).getByText('Anexo Contrato adicionado.'),
    ).toBeTruthy();

    const input = within(panel()).getByLabelText('Anexar arquivo');
    const big = new File(['x'], 'grande.pdf');
    Object.defineProperty(big, 'size', { value: MAX_ATTACHMENT_BYTES + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect((await within(panel()).findByRole('alert')).textContent).toContain(
      'grande.pdf',
    );

    fireEvent.change(input, {
      target: {
        files: [new File(['olá'], 'nota.txt', { type: 'text/plain' })],
      },
    });
    const file = await within(panel()).findByRole('link', { name: 'nota.txt' });
    expect(file.getAttribute('href')).toMatch(/^data:text\/plain/);
    expect(file.getAttribute('download')).toBe('nota.txt');
    expect(within(panel()).queryByRole('alert')).toBeNull();

    fireEvent.click(
      within(panel()).getByRole('button', {
        name: 'Remover o anexo Contrato',
      }),
    );
    expect(
      within(panel()).queryByRole('link', { name: 'Contrato' }),
    ).toBeNull();
  });

  it('avisa quando o navegador não tem espaço para gravar', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('cheio', 'QuotaExceededError');
      });
    render(<KanbanBoard initialLanes={lanes} storageKey="quadro:teste" />);

    expect(
      await screen.findByText(/O navegador não tem mais espaço/),
    ).toBeTruthy();
    setItem.mockRestore();
  });
});
