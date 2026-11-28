import { fireEvent, within } from '@testing-library/react';

import {
  approval,
  branching,
  exception,
  step,
  waitEvent,
} from '@/shared/process/engine-test-kit';
import {
  linearPlan,
  parallelPlan,
  planAround,
} from '@/shared/process/engine-test-plans';

import {
  activeStep,
  activeStepNames,
  freezeClock,
  processSection,
  releaseClock,
  renderRunning,
} from './process-test-kit';
import { announcement, detailsPanel } from './stored-board-test-kit';

function click(container: HTMLElement, name: string): void {
  fireEvent.click(within(container).getByRole('button', { name }));
}

function type(container: HTMLElement, label: string, value: string): void {
  fireEvent.change(within(container).getByLabelText(label), {
    target: { value },
  });
}

function refusal(container: HTMLElement): string | null {
  return within(container).getByRole('alert').textContent;
}

function trail(): HTMLElement {
  return within(processSection()).getByRole('group');
}

describe('KanbanBoard: ações de cada tipo de etapa', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('na decisão, segue pelo ramo escolhido', async () => {
    const route = branching({
      id: 'Rota',
      kind: 'decision',
      branches: { Rápido: 'done', Completo: 'other' },
    });
    await renderRunning(planAround(route));

    click(activeStep('Rota'), 'Seguir por Completo');

    expect(activeStepNames()).toEqual(['other']);
    expect(announcement()).toBe('Etapa Rota: Completo.');
    expect(
      within(trail()).getByText('Etapa Rota, caminho escolhido: Completo.'),
    ).toBeTruthy();
  });

  it('mostra quando seguir por cada caminho, para os que dizem a condição', async () => {
    const route = branching({
      id: 'Rota',
      kind: 'decision',
      branches: { Rápido: 'done', Completo: 'other' },
    });
    const explained = {
      ...route,
      exits: [
        { ...route.exits[0], condition: 'valor até mil' },
        { ...route.exits[1], description: 'todo o resto' },
      ],
    };
    await renderRunning(planAround(explained));
    const item = activeStep('Rota');

    expect(within(item).getByText('Rápido: valor até mil')).toBeTruthy();
    expect(within(item).getByText('Completo: todo o resto')).toBeTruthy();
  });

  it('na decisão inclusiva, recusa sem caminho marcado e segue pelos marcados', async () => {
    const route = branching({
      id: 'Rota',
      kind: 'inclusive-split',
      branches: { Fiscal: 'done', Jurídico: 'other' },
    });
    await renderRunning(planAround(route));
    const item = activeStep('Rota');

    click(item, 'Seguir pelos caminhos marcados');
    expect(refusal(item)).toBe('Escolha ao menos um caminho.');

    const paths = within(item).getByRole('group', {
      name: 'Caminhos a seguir',
    });
    fireEvent.click(within(paths).getByRole('checkbox', { name: 'Fiscal' }));
    fireEvent.click(within(paths).getByRole('checkbox', { name: 'Jurídico' }));
    fireEvent.click(within(paths).getByRole('checkbox', { name: 'Fiscal' }));
    fireEvent.click(within(paths).getByRole('checkbox', { name: 'Fiscal' }));
    click(item, 'Seguir pelos caminhos marcados');

    expect(activeStepNames()).toEqual(['done', 'other']);
    expect(announcement()).toBe('Etapa Rota: Fiscal, Jurídico.');
  });

  it('na decisão inclusiva, mantém o foco no caminho marcado, para quem usa o teclado', async () => {
    const route = branching({
      id: 'Rota',
      kind: 'inclusive-split',
      branches: { Fiscal: 'done', Jurídico: 'other' },
    });
    await renderRunning(planAround(route));
    const fiscal = within(activeStep('Rota')).getByRole<HTMLInputElement>(
      'checkbox',
      { name: 'Fiscal' },
    );
    fiscal.focus();

    fireEvent.click(fiscal);

    expect(fiscal.checked).toBe(true);
    expect(document.activeElement).toBe(fiscal);
  });

  it('na aprovação, exige o motivo para rejeitar e segue pelo desfecho escolhido', async () => {
    const check = approval({
      id: 'Aprovar pedido',
      approved: 'done',
      rejected: 'other',
    });
    await renderRunning(planAround(check));
    const item = activeStep('Aprovar pedido');
    expect(within(item).getByText('Obrigatória para rejeitar.')).toBeTruthy();

    click(item, 'Rejeitar');
    expect(refusal(item)).toBe('Informe o motivo da rejeição.');

    type(item, 'Observação', 'Falta documento');
    click(item, 'Rejeitar');

    expect(activeStepNames()).toEqual(['other']);
    expect(
      within(trail()).getByText('Aprovação Aprovar pedido: Rejeitado.'),
    ).toBeTruthy();
    expect(
      within(detailsPanel()).getByText(
        'Etapa Aprovar pedido resolvida: Rejeitado.',
      ),
    ).toBeTruthy();
  });

  it('na aprovação, aprova sem motivo', async () => {
    const check = approval({
      id: 'Aprovar pedido',
      approved: 'done',
      rejected: 'other',
    });
    await renderRunning(planAround(check));

    click(activeStep('Aprovar pedido'), 'Aprovar');

    expect(activeStepNames()).toEqual(['done']);
    expect(announcement()).toBe('Etapa Aprovar pedido: Aprovado.');
  });

  it('na espera por evento com prazo, oferece o evento recebido e o prazo expirado', async () => {
    const wait = waitEvent({
      id: 'Aguardar resposta',
      received: 'done',
      expired: 'other',
      deadline: { amount: 1, unit: 'hours' },
    });
    await renderRunning(planAround(wait));

    click(activeStep('Aguardar resposta'), 'Prazo expirado');

    expect(activeStepNames()).toEqual(['other']);
  });

  it('na espera por evento sem prazo, só oferece o evento recebido', async () => {
    const wait = waitEvent({ id: 'Aguardar resposta', received: 'done' });
    await renderRunning(planAround(wait));
    const item = activeStep('Aguardar resposta');

    expect(
      within(item).queryByRole('button', { name: 'Prazo expirado' }),
    ).toBeNull();
    click(item, 'Evento recebido');

    expect(activeStepNames()).toEqual(['done']);
  });
});

describe('KanbanBoard: exceção e card filho da etapa', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('registra a exceção que interrompe a etapa e segue pelo desvio dela', async () => {
    const risky = step({
      id: 'Cobrar',
      to: 'done',
      data: { events: [exception({ id: 'Falha', to: 'other' })] },
    });
    await renderRunning(planAround(risky));

    click(
      activeStep('Cobrar'),
      'Registrar exceção: Falha (interrompe a etapa)',
    );

    expect(activeStepNames()).toEqual(['other']);
    expect(announcement()).toBe('Exceção Falha registrada na etapa Cobrar.');
    expect(
      within(trail()).getByText('Exceção na etapa Cobrar: Falha.'),
    ).toBeTruthy();
  });

  it('registra a exceção por tempo que não interrompe: a etapa continua e a observação vai para a trilha', async () => {
    const slow = step({
      id: 'Cobrar',
      to: 'done',
      data: {
        events: [
          exception({
            id: 'Demora',
            to: 'other',
            interrupting: false,
            trigger: 'timeout',
            timeout: { amount: 1, unit: 'days' },
          }),
        ],
      },
    });
    await renderRunning(planAround(slow));
    const item = activeStep('Cobrar');
    expect(within(item).getByText(/O tempo se esgota em/)).toBeTruthy();
    type(item, 'Observação', 'Cliente pediu prazo');

    click(item, 'Registrar exceção: Demora (a etapa continua)');

    expect(activeStepNames()).toEqual(['Cobrar', 'other']);
    const note = within(activeStep('Cobrar')).getByLabelText('Observação');
    expect((note as HTMLTextAreaElement).value).toBe('');
    expect(
      within(trail()).getByText('Observação: Cliente pediu prazo'),
    ).toBeTruthy();
  });

  it('cria o card filho da etapa, anuncia e mostra o link para ele com a coluna', async () => {
    await renderRunning(linearPlan);

    click(activeStep('a'), 'Criar card filho para esta etapa');

    const item = activeStep('a');
    expect(announcement()).toBe('Card filho criado para a etapa a.');
    expect(within(item).getByText(/Card filho desta etapa:/)).toBeTruthy();
    expect(within(item).getByText('(A fazer)')).toBeTruthy();
    expect(
      within(item).queryByRole('button', {
        name: 'Criar card filho para esta etapa',
      }),
    ).toBeNull();
    expect(
      within(trail()).getByText('Etapa a entregue a um card filho.'),
    ).toBeTruthy();

    click(item, 'a');

    const title = within(detailsPanel()).getByLabelText('Título');
    expect((title as HTMLInputElement).value).toBe('a');
  });

  it('ao criar o card filho, leva o foco ao título da seção, porque o botão sai da tela', async () => {
    await renderRunning(linearPlan);
    const create = within(activeStep('a')).getByRole('button', {
      name: 'Criar card filho para esta etapa',
    });
    create.focus();

    fireEvent.click(create);

    expect(document.activeElement).toBe(
      within(processSection()).getByRole('heading', { name: 'Processo' }),
    );
  });

  it('não oferece card filho para a etapa que só espera os outros caminhos', async () => {
    await renderRunning(parallelPlan);

    click(activeStep('a'), 'Concluir etapa');

    expect(
      within(activeStep('join')).queryByRole('button', {
        name: 'Criar card filho para esta etapa',
      }),
    ).toBeNull();
    expect(
      within(activeStep('b')).getByRole('button', {
        name: 'Criar card filho para esta etapa',
      }),
    ).toBeTruthy();
  });
});
