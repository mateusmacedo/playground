import { fireEvent, render, screen, within } from '@testing-library/react';

import { type PendingStep, pendingSteps } from './model/pending-steps';
import { PendingStepsTable } from './pending-steps-table';
import { STEPS_NOW, stepsBoard } from './pending-steps-test-data';

function setup(steps?: readonly PendingStep[]) {
  const onOpen = vi.fn();
  render(
    <PendingStepsTable
      steps={steps ?? pendingSteps({ board: stepsBoard(), now: STEPS_NOW })}
      keyPrefix="QD"
      onOpen={onOpen}
    />,
  );
  return onOpen;
}

function table(): HTMLElement {
  return screen.getByRole('table', {
    name: 'Etapas pendentes do quadro, uma por linha',
  });
}

function row(card: string): HTMLElement {
  return within(table()).getByRole('row', { name: new RegExp(card) });
}

/** Coluna, etapa, tipo, papel e responsável da linha. */
function facts(card: string): (string | null)[] {
  // NOTE: o nome da etapa é o cabeçalho da linha; as células são card, coluna, tipo, papel, responsável, desde e prazo.
  const cells = within(row(card)).getAllByRole('cell');
  const step = within(row(card)).getByRole('rowheader');
  return [cells[1], step, cells[2], cells[3], cells[4]].map(
    (cell) => cell.textContent,
  );
}

function moments(card: string): HTMLTimeElement[] {
  return Array.from(row(card).querySelectorAll('time'));
}

describe('PendingStepsTable', () => {
  it('mostra uma etapa por linha, na ordem recebida, com as colunas da visão', () => {
    setup();

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Card',
      'Coluna',
      'Etapa',
      'Tipo',
      'Papel',
      'Responsável',
      'Desde',
      'Prazo',
    ]);
    expect(
      within(table())
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Analisar', 'Revisar', 'a', 'checkem sub']);
  });

  it('traz a coluna, a etapa, o tipo, o papel e o responsável de cada etapa', () => {
    setup();

    expect(facts('Contrato')).toEqual([
      'Em andamento',
      'Analisar',
      'Tarefa humana',
      'Analista',
      'Ana',
    ]);
    expect(facts('Cadastro')).toEqual(['A fazer', 'a', 'Etapa', '—', '—']);
  });

  it('destaca a etapa atrasada com o selo, e só ela', () => {
    setup();

    expect(within(row('Contrato')).getByText('Atrasada')).toBeTruthy();
    expect(within(table()).getAllByText('Atrasada')).toHaveLength(1);
  });

  it('mostra desde quando a etapa espera e o prazo, ou um traço quando não há prazo', () => {
    setup();

    expect(moments('Contrato').map((time) => time.dateTime)).toEqual([
      '2026-11-26T10:00:00.000Z',
      '2026-11-26T11:00:00.000Z',
    ]);
    expect(moments('Contrato')[0].textContent).not.toBe('');
    expect(moments('Cadastro')).toHaveLength(1);
    expect(within(row('Cadastro')).getAllByText('—')).toHaveLength(3);
  });

  it('diz em que subprocesso a etapa está', () => {
    setup();

    expect(within(row('Auditoria')).getByText('em sub')).toBeTruthy();
    expect(within(row('Contrato')).queryByText(/^em /)).toBeNull();
  });

  it('abre o card pelo título e marca o botão para o foco voltar a ele', () => {
    const onOpen = setup();
    const title = within(row('Proposta')).getByRole('button', {
      name: 'Proposta',
    });

    fireEvent.click(title);

    expect(onOpen).toHaveBeenCalledWith('proposta');
    expect(title.getAttribute('data-card-open')).toBe('proposta');
    expect(within(row('Proposta')).getByText('QD-1')).toBeTruthy();
  });

  it('deixa o título do card ao alcance do teclado, como botão nativo', () => {
    setup();
    const title = within(row('Proposta')).getByRole('button', {
      name: 'Proposta',
    });

    title.focus();

    expect(document.activeElement).toBe(title);
    expect(title.tagName).toBe('BUTTON');
  });

  it('deixa em branco o instante que não dá para ler', () => {
    const steps = pendingSteps({ board: stepsBoard(), now: STEPS_NOW });
    setup([{ ...steps[0], since: 'ontem' }]);

    expect(moments('Contrato')[0].textContent).toBe('');
  });
});
