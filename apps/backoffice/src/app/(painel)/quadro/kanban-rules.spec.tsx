import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { KanbanBoard } from './kanban-board';
import type { Board, BoardRules } from './model/board';
import {
  boardProcess,
  type ProcessBoardParams,
  processBoard,
  runningCard,
} from './model/process-test-data';
import { parseStoredBoard, serializeBoard } from './model/storage';
import { settled } from './process-test-kit';
import {
  announcement,
  detailsPanel,
  openCard,
  TEST_BOARD_KEY,
} from './stored-board-test-kit';

const settings = {
  name: 'Quadro',
  validateName: (name: string) => name.trim() || null,
  onRename: vi.fn(),
};

/** As regras, na ordem em que a janela as mostra; só a última não depende da coluna de conclusão. */
const RULE_LABELS = [
  'Card pai espera os filhos',
  'Card pai acompanha os filhos',
  'Conclusão espera o processo',
  'Processo concluído conclui o card',
  'Conclusão espera as dependências',
  'Card filho herda do pai',
];

const NEEDS_DONE_LANE =
  'Depende da coluna de conclusão: escolha uma acima para usar esta regra.';

/** Quadro com o card "Tarefa" na coluna A fazer. */
function plainBoard(params: ProcessBoardParams = {}): Board {
  return processBoard({
    todo: [{ id: 't1', title: 'Tarefa', number: 1 }],
    ...params,
  });
}

/** Monta o quadro gravado com a janela "Configurar quadro" disponível e espera a leitura dele. */
async function renderConfigurable(board: Board): Promise<void> {
  localStorage.setItem(TEST_BOARD_KEY, serializeBoard(board));
  render(
    <KanbanBoard
      initialLanes={[]}
      storageKey={TEST_BOARD_KEY}
      settings={settings}
    />,
  );
  await screen.findAllByText(board.lanes[0].cards[0].title);
}

async function openSettings(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: 'Configurar quadro' }));
  return screen.findByRole('dialog', { name: 'Configurar quadro' });
}

function rulesGroup(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole('group', { name: 'Regras do quadro' });
}

function rule(dialog: HTMLElement, name: string): HTMLInputElement {
  return within(rulesGroup(dialog)).getByRole<HTMLInputElement>('checkbox', {
    name,
  });
}

/** O texto que explica a regra, ligado à caixa dela. */
function ruleHelp(box: HTMLElement): string {
  const helpId = box.getAttribute('aria-describedby') ?? '';
  return document.getElementById(helpId)?.textContent ?? '';
}

function chooseDoneLane(dialog: HTMLElement, laneId: string): void {
  fireEvent.change(within(dialog).getByLabelText('Coluna de conclusão'), {
    target: { value: laneId },
  });
}

/** Salva a janela e espera ela sair da tela. */
async function save(dialog: HTMLElement): Promise<void> {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Configurar quadro' }),
    ).toBeNull(),
  );
}

function storedRules(): BoardRules | undefined {
  return parseStoredBoard(localStorage.getItem(TEST_BOARD_KEY))?.config.rules;
}

describe('KanbanBoard: regras do quadro', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('mostra as seis regras desligadas, cada uma com a explicação dela', async () => {
    await renderConfigurable(plainBoard());
    const dialog = await openSettings();

    const boxes = within(rulesGroup(dialog)).getAllByRole<HTMLInputElement>(
      'checkbox',
    );

    expect(boxes.map((box) => box.labels?.[0]?.textContent)).toEqual(
      RULE_LABELS,
    );
    expect(boxes.every((box) => !box.checked && !box.disabled)).toBe(true);
    expect(ruleHelp(rule(dialog, 'Card pai espera os filhos'))).toBe(
      'O card pai só entra na coluna de conclusão depois de todos os filhos.',
    );
    expect(ruleHelp(rule(dialog, 'Card pai acompanha os filhos'))).toBe(
      'Quando o último filho chega à coluna de conclusão, o card pai vai junto.',
    );
    expect(ruleHelp(rule(dialog, 'Conclusão espera o processo'))).toBe(
      'O card com processo em andamento não entra na coluna de conclusão.',
    );
    expect(ruleHelp(rule(dialog, 'Processo concluído conclui o card'))).toBe(
      'Quando o processo termina, o card vai para a coluna de conclusão.',
    );
    expect(ruleHelp(rule(dialog, 'Conclusão espera as dependências'))).toBe(
      'O card bloqueado por outro ainda não concluído não entra na coluna de conclusão.',
    );
    expect(ruleHelp(rule(dialog, 'Card filho herda do pai'))).toBe(
      'O card filho novo recebe o responsável e as etiquetas do card pai.',
    );
  });

  it('sem coluna de conclusão, trava as regras que dependem dela e diz o motivo', async () => {
    await renderConfigurable(plainBoard({ withoutDoneLane: true }));
    const dialog = await openSettings();

    for (const label of RULE_LABELS.slice(0, 5)) {
      expect(rule(dialog, label).disabled).toBe(true);
      expect(ruleHelp(rule(dialog, label))).toContain(NEEDS_DONE_LANE);
    }
    const inherits = rule(dialog, 'Card filho herda do pai');
    expect(inherits.disabled).toBe(false);
    expect(ruleHelp(inherits)).not.toContain(NEEDS_DONE_LANE);
  });

  it('libera as regras quando a coluna de conclusão é escolhida na janela', async () => {
    await renderConfigurable(plainBoard({ withoutDoneLane: true }));
    const dialog = await openSettings();

    chooseDoneLane(dialog, 'done');

    for (const label of RULE_LABELS) {
      expect(rule(dialog, label).disabled).toBe(false);
      expect(ruleHelp(rule(dialog, label))).not.toContain(NEEDS_DONE_LANE);
    }
  });

  it('grava as regras marcadas, anuncia e as mostra marcadas ao reabrir a janela', async () => {
    await renderConfigurable(plainBoard());
    const dialog = await openSettings();
    fireEvent.click(rule(dialog, 'Conclusão espera o processo'));
    fireEvent.click(rule(dialog, 'Card filho herda do pai'));

    await save(dialog);

    expect(announcement()).toBe('Configuração do quadro salva.');
    expect(storedRules()).toEqual({
      doneWaitsProcess: true,
      childInherits: true,
    });
    const reopened = await openSettings();
    expect(rule(reopened, 'Conclusão espera o processo').checked).toBe(true);
    expect(rule(reopened, 'Card filho herda do pai').checked).toBe(true);
    expect(rule(reopened, 'Card pai espera os filhos').checked).toBe(false);
  });

  it('desliga a regra que a pessoa desmarca', async () => {
    await renderConfigurable(plainBoard({ rules: { childInherits: true } }));
    const dialog = await openSettings();

    fireEvent.click(rule(dialog, 'Card filho herda do pai'));
    await save(dialog);

    expect(storedRules()).toBeUndefined();
  });

  it('não grava as regras marcadas quando a pessoa cancela a janela', async () => {
    await renderConfigurable(plainBoard());
    const dialog = await openSettings();
    fireEvent.click(rule(dialog, 'Card filho herda do pai'));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Configurar quadro' }),
      ).toBeNull(),
    );

    expect(storedRules()).toBeUndefined();
    const reopened = await openSettings();
    expect(rule(reopened, 'Card filho herda do pai').checked).toBe(false);
  });

  it('mantém ligada a regra travada quando o quadro fica sem coluna de conclusão', async () => {
    await renderConfigurable(plainBoard({ rules: { doneWaitsProcess: true } }));
    const dialog = await openSettings();

    chooseDoneLane(dialog, '');
    const waits = rule(dialog, 'Conclusão espera o processo');
    expect(waits.disabled).toBe(true);
    expect(waits.checked).toBe(true);
    await save(dialog);

    expect(storedRules()).toEqual({ doneWaitsProcess: true });
  });

  it('mantém o foco na caixa da regra depois de marcá-la', async () => {
    await renderConfigurable(plainBoard());
    const dialog = await openSettings();
    const inherits = rule(dialog, 'Card filho herda do pai');
    inherits.focus();

    fireEvent.click(inherits);

    expect(inherits.checked).toBe(true);
    expect(document.activeElement).toBe(inherits);
  });

  it('a regra gravada passa a valer: o card com processo em andamento não entra na coluna de conclusão', async () => {
    await renderConfigurable(
      processBoard({
        todo: [runningCard({ id: 'c1' })],
        processes: [boardProcess()],
      }),
    );
    const dialog = await openSettings();
    fireEvent.click(rule(dialog, 'Conclusão espera o processo'));
    await save(dialog);
    openCard('Card c1');
    await settled();

    fireEvent.change(within(detailsPanel()).getByLabelText('Coluna'), {
      target: { value: 'done' },
    });

    expect(
      screen.getByText(
        'O card Card c1 tem o processo Processo em andamento: conclua ou cancele o processo antes de levar o card para Concluído.',
      ),
    ).toBeTruthy();
    const lane = within(detailsPanel()).getByLabelText<HTMLSelectElement>(
      'Coluna',
    );
    expect(lane.value).toBe('todo');
  });
});
