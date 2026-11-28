import { fireEvent, render, screen, within } from '@testing-library/react';

import type { BoardCard } from '../model/board';
import { ChecklistSection } from './checklist-section';

const card: BoardCard = {
  id: 'card',
  title: 'Card',
  checklist: [
    { id: 'i1', text: 'Revisar o texto', done: true },
    { id: 'i2', text: 'Publicar', done: false },
  ],
};

interface SetupParams {
  /** Id do card filho que o quadro cria; sem ele, o quadro recusa a conversão. */
  readonly childId?: string;
  readonly silent?: boolean;
}

function setup(params: SetupParams = {}) {
  const commands = {
    addChecklistItem: vi.fn(),
    toggleChecklistItem: vi.fn(),
    removeChecklistItem: vi.fn(),
    convertChecklistItem: vi.fn(() => params.childId),
  };
  const onAnnounce = vi.fn();
  render(
    <ChecklistSection
      card={card}
      commands={commands}
      onAnnounce={params.silent ? undefined : onAnnounce}
    />,
  );
  return { commands, onAnnounce };
}

function section(): HTMLElement {
  return screen.getByRole('region', { name: 'Checklist' });
}

function convertButton(item: string): HTMLElement {
  return within(section()).getByRole('button', {
    name: `Converter o item ${item} em card filho`,
  });
}

describe('ChecklistSection', () => {
  it('mostra o progresso e, em cada item, as ações de converter e de remover', () => {
    setup();

    expect(within(section()).getByText('1 de 2')).toBeTruthy();
    expect(convertButton('Revisar o texto').getAttribute('title')).toBe(
      'Converter em card filho',
    );
    expect(convertButton('Publicar')).toBeTruthy();
    expect(
      within(section()).getByRole('button', {
        name: 'Remover o item Publicar',
      }),
    ).toBeTruthy();
  });

  it('converte o item em card filho, avisa o leitor de tela e leva o foco ao título da seção', () => {
    const { commands, onAnnounce } = setup({ childId: 'card-9' });

    fireEvent.click(convertButton('Publicar'));

    expect(commands.convertChecklistItem).toHaveBeenCalledWith({
      cardId: 'card',
      itemId: 'i2',
    });
    expect(onAnnounce).toHaveBeenCalledWith(
      'Item Publicar convertido em card filho.',
    );
    expect(document.activeElement).toBe(
      within(section()).getByRole('heading', { name: 'Checklist' }),
    );
  });

  it('não anuncia nem tira o foco do botão quando o quadro recusa a conversão', () => {
    const { onAnnounce } = setup();
    const button = convertButton('Publicar');
    button.focus();

    fireEvent.click(button);

    expect(onAnnounce).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });

  it('converte em silêncio quando não recebe o anúncio', () => {
    const { commands } = setup({ childId: 'card-9', silent: true });

    fireEvent.click(convertButton('Revisar o texto'));

    expect(commands.convertChecklistItem).toHaveBeenCalledTimes(1);
  });

  it('marca e remove o item pelos comandos do quadro', () => {
    const { commands } = setup();

    fireEvent.click(within(section()).getByLabelText('Publicar'));
    fireEvent.click(
      within(section()).getByRole('button', {
        name: 'Remover o item Publicar',
      }),
    );

    expect(commands.toggleChecklistItem).toHaveBeenCalledWith({
      cardId: 'card',
      itemId: 'i2',
    });
    expect(commands.removeChecklistItem).toHaveBeenCalledWith({
      cardId: 'card',
      itemId: 'i2',
    });
  });

  it('mantém a mesma caixa e o foco nela depois de marcar o item', () => {
    const commands = {
      addChecklistItem: vi.fn(),
      toggleChecklistItem: vi.fn(),
      removeChecklistItem: vi.fn(),
      convertChecklistItem: vi.fn(),
    };
    const { rerender } = render(
      <ChecklistSection card={card} commands={commands} />,
    );
    const box = within(section()).getByRole('checkbox', { name: 'Publicar' });
    box.focus();

    fireEvent.click(box);
    const doneCard: BoardCard = {
      ...card,
      checklist: card.checklist?.map((item) => ({ ...item, done: true })),
    };
    rerender(<ChecklistSection card={doneCard} commands={commands} />);

    const sameBox = within(section()).getByRole('checkbox', {
      name: 'Publicar',
    });
    expect(sameBox).toBe(box);
    expect(sameBox).toHaveProperty('checked', true);
    expect(document.activeElement).toBe(box);
  });
});
