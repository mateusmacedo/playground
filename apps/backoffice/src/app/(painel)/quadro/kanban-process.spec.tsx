import { fireEvent, screen, within } from '@testing-library/react';

import { linearPlan } from '@/shared/process/engine-test-plans';

import { processBoard } from './model/process-test-data';
import {
  activeStep,
  activeStepNames,
  freezeClock,
  openProcessOf,
  processSection,
  published,
  releaseClock,
  renderRunning,
  seedCatalog,
  settled,
} from './process-test-kit';
import {
  announcement,
  cardItem,
  detailsPanel,
  renderStoredBoard,
  showView,
} from './stored-board-test-kit';

function heading(): HTMLElement {
  return within(processSection()).getByRole('heading', { name: 'Processo' });
}

function button(name: string): HTMLElement {
  return within(processSection()).getByRole('button', { name });
}

/** Quadro com o card "Tarefa", sem processo, na coluna A fazer. */
async function renderPlainBoard(): Promise<void> {
  await renderStoredBoard(
    processBoard({ todo: [{ id: 't1', title: 'Tarefa', number: 1 }] }),
  );
}

/** Abre a escolha do processo no card aberto e espera a leitura do catálogo. */
async function openPicker(label = 'Escolher processo'): Promise<void> {
  fireEvent.click(button(label));
  await settled();
}

/** Inicia o processo escolhido e espera a seção ler o catálogo, que ela consulta atrás de versão mais nova. */
async function startChosen(): Promise<void> {
  fireEvent.click(button('Iniciar processo'));
  await settled();
}

/** O histórico do card aberto, no painel de detalhes. */
function history(): HTMLElement {
  return within(detailsPanel()).getByRole('region', { name: 'Histórico' });
}

function completeStep(name: string): void {
  const step = activeStep(name);
  fireEvent.click(within(step).getByRole('button', { name: 'Concluir etapa' }));
}

describe('KanbanBoard: iniciar o processo de um card', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('diz que o card não segue processo e só lê o catálogo quando a pessoa pede para escolher', async () => {
    seedCatalog([published({ id: 'p1', name: 'Atendimento' })]);
    await renderPlainBoard();
    const section = await openProcessOf('Tarefa');

    expect(
      within(section).getByText('Este card não segue nenhum processo.'),
    ).toBeTruthy();
    const open = button('Escolher processo');
    expect(open.getAttribute('aria-expanded')).toBe('false');
    expect(within(section).queryByRole('combobox')).toBeNull();

    fireEvent.click(open);
    expect(within(section).getByRole('status').textContent).toBe(
      'Carregando os processos…',
    );
    await settled();

    expect(open.getAttribute('aria-expanded')).toBe('true');
    const select = within(section).getByRole('combobox', { name: 'Processo' });
    expect(within(select).getByRole('option').textContent).toBe(
      'Atendimento (versão 1)',
    );
  });

  it('explica o catálogo sem processo publicado e aponta o editor de processos', async () => {
    await renderPlainBoard();
    const section = await openProcessOf('Tarefa');
    await openPicker();

    expect(
      within(section).getByText(/Nenhum processo publicado ainda\./),
    ).toBeTruthy();
    const link = within(section).getByRole('link', {
      name: 'Abrir o editor de processos',
    });
    expect(link.getAttribute('href')).toBe('/processos');
  });

  it('inicia o processo escolhido na última versão, anuncia e leva o foco ao título da seção', async () => {
    seedCatalog([
      published({ id: 'p1', name: 'Atendimento' }),
      published({ id: 'p2', name: 'Compra', versions: 2 }),
    ]);
    await renderPlainBoard();
    const section = await openProcessOf('Tarefa');
    await openPicker();
    fireEvent.change(
      within(section).getByRole('combobox', { name: 'Processo' }),
      { target: { value: 'p2' } },
    );
    button('Iniciar processo').focus();

    await startChosen();

    expect(within(section).getByText('Compra')).toBeTruthy();
    expect(within(section).getByText('versão 2')).toBeTruthy();
    expect(within(section).getByText('Em andamento')).toBeTruthy();
    expect(activeStepNames()).toEqual(['a']);
    expect(announcement()).toBe('Processo Compra iniciado no card Tarefa.');
    expect(document.activeElement).toBe(heading());
    expect(
      within(history()).getByText('Processo Compra iniciado.'),
    ).toBeTruthy();
  });

  it('mostra no card do quadro e na lista o selo do processo, com as etapas feitas do total', async () => {
    seedCatalog([published({ id: 'p1', name: 'Atendimento' })]);
    await renderPlainBoard();
    await openProcessOf('Tarefa');
    await openPicker();
    await startChosen();

    expect(
      within(cardItem('Tarefa')).getByText(
        'Processo Atendimento: 0 de 2 etapas feitas',
      ),
    ).toBeTruthy();

    showView('Lista');
    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'Processo' }),
    ).toBeTruthy();
    expect(
      within(table).getByText('Processo Atendimento: 0 de 2 etapas feitas'),
    ).toBeTruthy();
  });

  it('na lista, o card sem processo fica com um traço na coluna do processo', async () => {
    await renderPlainBoard();
    showView('Lista');

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    const row = within(table).getAllByRole('row')[1];
    const cells = within(row).getAllByRole('cell');

    expect(cells[headers.indexOf('Processo')].textContent).toBe('—');
  });
});

describe('KanbanBoard: andar com o processo de um card', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('mostra o processo, a versão, o andamento em barra e em texto e a etapa ativa', async () => {
    const section = await renderRunning(linearPlan);

    expect(within(section).getByText('versão 1')).toBeTruthy();
    expect(within(section).getByText('Em andamento')).toBeTruthy();
    const bar = within(section).getByRole('progressbar', {
      name: 'Andamento do processo',
    });
    expect(bar.getAttribute('aria-valuetext')).toBe('0 de 2 etapas feitas');
    expect(within(section).getByText('0 de 2 etapas feitas')).toBeTruthy();
    expect(activeStepNames()).toEqual(['a']);
    expect(within(activeStep('a')).getByText('Etapa')).toBeTruthy();
  });

  it('conclui a etapa com observação: avança, anuncia, registra quem agiu e leva o foco ao título', async () => {
    const section = await renderRunning(linearPlan);
    const step = activeStep('a');
    fireEvent.change(within(step).getByLabelText('Observação'), {
      target: { value: 'Conferido com o cliente' },
    });
    const complete = within(step).getByRole('button', {
      name: 'Concluir etapa',
    });
    complete.focus();

    fireEvent.click(complete);

    expect(activeStepNames()).toEqual(['b']);
    expect(announcement()).toBe('Etapa a concluída.');
    expect(document.activeElement).toBe(heading());
    expect(within(section).getByText('1 de 2 etapas feitas')).toBeTruthy();
    const trail = within(section).getByRole('group');
    expect(within(trail).getByText('Etapa a concluída.')).toBeTruthy();
    expect(within(trail).getByText(/por Você/)).toBeTruthy();
    expect(
      within(trail).getByText('Observação: Conferido com o cliente'),
    ).toBeTruthy();
    expect(within(history()).getByText('Etapa a resolvida.')).toBeTruthy();
  });

  it('ao resolver a última etapa, mostra o desfecho e a trilha aberta e anuncia o fim do processo', async () => {
    const section = await renderRunning(linearPlan);
    completeStep('a');
    completeStep('b');

    expect(within(section).getByText('Concluído')).toBeTruthy();
    expect(within(section).getByText('Desfecho: Concluído')).toBeTruthy();
    expect(within(section).getByText(/Encerrado em/)).toBeTruthy();
    expect(within(section).getByRole('group').hasAttribute('open')).toBe(true);
    expect(
      within(section).getByText(/Fim do processo: Concluído\./),
    ).toBeTruthy();
    expect(announcement()).toBe('Processo Processo concluído: Concluído.');
    expect(
      within(cardItem('Card c1')).getByText('Processo Processo: concluído'),
    ).toBeTruthy();
    expect(
      within(history()).getByText('Processo Processo concluído: Concluído.'),
    ).toBeTruthy();
  });

  it('tira do card o processo encerrado e deixa escolher outro', async () => {
    const section = await renderRunning(linearPlan);
    completeStep('a');
    completeStep('b');
    const remove = button('Remover processo');
    remove.focus();

    fireEvent.click(remove);

    expect(
      within(section).getByText('Este card não segue nenhum processo.'),
    ).toBeTruthy();
    expect(button('Escolher processo')).toBeTruthy();
    expect(announcement()).toBe('Processo Processo removido do card.');
    expect(document.activeElement).toBe(heading());
    expect(within(cardItem('Card c1')).queryByText(/^Processo /)).toBeNull();
  });

  it('com o processo encerrado, inicia outro no lugar dele', async () => {
    seedCatalog([published({ id: 'p9', name: 'Revisão' })]);
    const section = await renderRunning(linearPlan);
    completeStep('a');
    completeStep('b');

    await openPicker('Iniciar outro processo');
    await startChosen();

    expect(within(section).getByText('Revisão')).toBeTruthy();
    expect(within(section).getByText('Em andamento')).toBeTruthy();
    expect(activeStepNames()).toEqual(['a']);
  });
});
