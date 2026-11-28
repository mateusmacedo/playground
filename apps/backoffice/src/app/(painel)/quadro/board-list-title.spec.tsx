import { fireEvent, render, screen } from '@testing-library/react';

import { BoardListTitle } from './board-list-title';
import { type ListTree, listTree } from './list-tree';
import type { BoardCard, BoardLane } from './model/board';
import { listRows } from './model/views';

const parent: BoardCard = { id: 'pai', title: 'Pai' };
const child: BoardCard = { id: 'filho', title: 'Filho', parentId: 'pai' };
const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [parent, child] },
];

interface TreeParams {
  readonly collapsedRows?: readonly string[];
  readonly onChange?: (collapsedRows: readonly string[]) => void;
}

function treeOf(params: TreeParams = {}): ListTree {
  return listTree({
    rows: listRows({ lanes, people: new Map() }),
    collapsedRows: params.collapsedRows ?? [],
    onChange: params.onChange ?? vi.fn(),
  });
}

describe('BoardListTitle', () => {
  it('abre o card pelo título e marca o botão para o foco voltar a ele', () => {
    const onOpen = vi.fn();
    render(<BoardListTitle card={parent} blocked={false} onOpen={onOpen} />);
    const title = screen.getByRole('button', { name: 'Pai' });

    fireEvent.click(title);

    expect(onOpen).toHaveBeenCalledWith('pai');
    expect(title.getAttribute('data-card-open')).toBe('pai');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Bloqueado')).toBeNull();
  });

  it('mostra o selo do card bloqueado', () => {
    render(<BoardListTitle card={parent} blocked onOpen={vi.fn()} />);

    expect(screen.getByText('Bloqueado')).toBeTruthy();
  });

  it('na árvore, expõe o estado dos filhos e recolhe pelo botão', () => {
    const onChange = vi.fn();
    render(
      <BoardListTitle
        card={parent}
        blocked={false}
        tree={treeOf({ onChange })}
        onOpen={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Filhos de Pai' });

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(['pai']);
  });

  it('na árvore, mostra recolhido o card com os filhos escondidos', () => {
    render(
      <BoardListTitle
        card={parent}
        blocked={false}
        tree={treeOf({ collapsedRows: ['pai'] })}
        onOpen={vi.fn()}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Filhos de Pai' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('na árvore, o card sem filhos vem com o recuo e o nível, sem botão de expandir', () => {
    const { container } = render(
      <BoardListTitle
        card={child}
        blocked={false}
        tree={treeOf()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText('Nível 2:')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Filhos de/ })).toBeNull();
    expect(
      (container.firstElementChild as HTMLElement).style.paddingInlineStart,
    ).toBe('1.5rem');
  });
});
