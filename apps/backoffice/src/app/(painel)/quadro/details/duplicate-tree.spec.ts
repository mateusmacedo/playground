import type { BoardLane } from '../model/board';
import { duplicateTreeAction } from './duplicate-tree';

const parent = { id: 'p', title: 'Pai' };
const child = { id: 'c', title: 'Filho', parentId: 'p' };
const lanes: readonly BoardLane[] = [
  { id: 'todo', title: 'A fazer', cards: [parent, child] },
];

interface SetupParams {
  /** Id da cópia que o quadro cria; sem ele, o quadro recusa a cópia. */
  readonly copyId?: string;
  readonly silent?: boolean;
}

function setup(params: SetupParams = {}) {
  const commands = { duplicateCardTree: vi.fn(() => params.copyId) };
  const onOpenCard = vi.fn();
  const onAnnounce = vi.fn();
  const action = duplicateTreeAction({
    card: parent,
    lanes,
    commands,
    onOpenCard,
    onAnnounce: params.silent ? undefined : onAnnounce,
  });
  return { action, commands, onOpenCard, onAnnounce };
}

describe('duplicateTreeAction', () => {
  it('não existe para o card sem filhos', () => {
    const action = duplicateTreeAction({
      card: child,
      lanes,
      commands: { duplicateCardTree: vi.fn() },
      onOpenCard: vi.fn(),
    });

    expect(action).toBeUndefined();
  });

  it('duplica o card com os filhos, abre a cópia e avisa o leitor de tela', () => {
    const { action, commands, onOpenCard, onAnnounce } = setup({
      copyId: 'copy',
    });

    action?.();

    expect(commands.duplicateCardTree).toHaveBeenCalledWith('p');
    expect(onOpenCard).toHaveBeenCalledWith('copy');
    expect(onAnnounce).toHaveBeenCalledWith(
      'Card Pai duplicado com os filhos.',
    );
  });

  it('não abre nem anuncia nada quando o quadro recusa a cópia', () => {
    const { action, onOpenCard, onAnnounce } = setup();

    action?.();

    expect(onOpenCard).not.toHaveBeenCalled();
    expect(onAnnounce).not.toHaveBeenCalled();
  });

  it('abre a cópia mesmo sem ter como anunciar', () => {
    const { action, onOpenCard } = setup({ copyId: 'copy', silent: true });

    action?.();

    expect(onOpenCard).toHaveBeenCalledWith('copy');
  });
});
