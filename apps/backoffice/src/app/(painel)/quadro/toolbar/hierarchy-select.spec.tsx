import { fireEvent, render, screen } from '@testing-library/react';

import { HierarchySelect } from './hierarchy-select';

function select(): HTMLSelectElement {
  return screen.getByRole('combobox', {
    name: 'Filtrar por hierarquia',
  }) as HTMLSelectElement;
}

describe('HierarchySelect', () => {
  it('oferece os quatro recortes da hierarquia e mostra o escolhido', () => {
    render(<HierarchySelect value="children" onChange={vi.fn()} />);

    expect(Array.from(select().options, (option) => option.text)).toEqual([
      'Todos os cards',
      'Só cards pai',
      'Só cards filhos',
      'Só cards de topo',
    ]);
    expect(select().value).toBe('children');
  });

  it('avisa o recorte escolhido', () => {
    const onChange = vi.fn();
    render(<HierarchySelect value="all" onChange={onChange} />);

    fireEvent.change(select(), { target: { value: 'top' } });

    expect(onChange).toHaveBeenCalledWith('top');
  });

  it('ignora um valor que não é um recorte', () => {
    const onChange = vi.fn();
    render(<HierarchySelect value="all" onChange={onChange} />);

    fireEvent.change(select(), { target: { value: 'outro' } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
