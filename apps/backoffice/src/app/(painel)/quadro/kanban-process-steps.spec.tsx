import { fireEvent, within } from '@testing-library/react';

import { begin, end, planOf, step } from '@/shared/process/engine-test-kit';
import {
  linearPlan,
  nestedPlan,
  parallelPlan,
  planAround,
} from '@/shared/process/engine-test-plans';

import { boardProcess, processBoard } from './model/process-test-data';
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
} from './process-test-kit';
import { cardItem, renderStoredBoard } from './stored-board-test-kit';

function click(container: HTMLElement, name: string): void {
  fireEvent.click(within(container).getByRole('button', { name }));
}

function trail(): HTMLElement {
  return within(processSection()).getByRole('group');
}

describe('KanbanBoard: o que a etapa ativa mostra', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('mostra o tipo, o papel, a descrição, as instruções, o resultado esperado, os dados e o prazo atrasado', async () => {
    const review = step({
      id: 'Revisar',
      kind: 'human-task',
      to: 'done',
      data: {
        role: 'Analista',
        description: 'Confere o pedido',
        instructions: 'Leia o contrato',
        expectedResult: 'Pedido conferido',
        details: [{ label: 'Sistema', value: 'Cadastro' }],
        dueIn: { amount: 30, unit: 'minutes' },
      },
    });
    await renderRunning(planAround(review));
    const item = activeStep('Revisar');

    expect(
      within(item).getByText('Tarefa humana · Papel: Analista'),
    ).toBeTruthy();
    expect(within(item).getByText('Confere o pedido')).toBeTruthy();
    expect(within(item).getByText('Leia o contrato')).toBeTruthy();
    expect(within(item).getByText('Pedido conferido')).toBeTruthy();
    expect(within(item).getByText('Cadastro')).toBeTruthy();
    expect(within(item).getByText('Prazo')).toBeTruthy();
    expect(within(item).getByText('Atrasada')).toBeTruthy();
    expect(
      within(cardItem('Card c1')).getByText(
        'Processo Processo: 0 de 2 etapas feitas, com etapa atrasada',
      ),
    ).toBeTruthy();
  });

  it('não marca como atrasada a etapa dentro do prazo', async () => {
    const calm = step({
      id: 'Revisar',
      to: 'done',
      data: { dueIn: { amount: 3, unit: 'days' } },
    });
    await renderRunning(planAround(calm));

    expect(within(activeStep('Revisar')).getByText('Prazo')).toBeTruthy();
    expect(within(activeStep('Revisar')).queryByText('Atrasada')).toBeNull();
  });

  it('mostra as instruções da etapa sem o prazo quando ela não tem um', async () => {
    const guided = step({
      id: 'Revisar',
      to: 'done',
      data: { instructions: 'Leia o contrato' },
    });
    await renderRunning(planAround(guided));
    const item = activeStep('Revisar');

    expect(within(item).getByText('Leia o contrato')).toBeTruthy();
    expect(within(item).queryByText('Prazo')).toBeNull();
  });

  it('diz que não há etapa à espera quando a ficha da execução não está em etapa do roteiro', async () => {
    const run = begin(linearPlan);
    const lost = run.tokens.map((token) => ({ ...token, stepRef: 'fora' }));
    await renderStoredBoard(
      processBoard({
        todo: [
          { id: 'c1', title: 'Card c1', process: { ...run, tokens: lost } },
        ],
        processes: [boardProcess(linearPlan)],
      }),
    );
    const section = await openProcessOf('Card c1');

    expect(
      within(section).getByText('Nenhuma etapa à espera de ação.'),
    ).toBeTruthy();
    expect(activeStepNames()).toEqual([]);
  });

  it('mostra como espera a etapa que chegou a uma junção antes dos outros caminhos', async () => {
    await renderRunning(parallelPlan);
    expect(activeStepNames()).toEqual(['a', 'b']);

    click(activeStep('a'), 'Concluir etapa');

    expect(activeStepNames()).toEqual(['b', 'join']);
    const join = activeStep('join');
    expect(within(join).getByText('Sincronização paralela')).toBeTruthy();
    expect(
      within(join).getByText('Aguardando os outros caminhos.'),
    ).toBeTruthy();
    expect(within(join).queryByRole('button')).toBeNull();
  });

  it('mostra o subprocesso aberto e, dentro dele, a etapa com o caminho até ela', async () => {
    await renderRunning(nestedPlan);

    expect(activeStepNames()).toEqual(['sub', 'check']);
    expect(
      within(activeStep('sub')).getByText(
        'Subprocesso em andamento: as etapas dele aparecem nesta lista.',
      ),
    ).toBeTruthy();
    expect(within(activeStep('sub')).queryByRole('button')).toBeNull();
    expect(
      within(activeStep('check')).getByText('Etapa · Em sub'),
    ).toBeTruthy();
  });

  it('avisa quando o processo já tem uma versão mais nova que a do card', async () => {
    seedCatalog([
      published({ id: 'process-1', name: 'Processo', versions: 3 }),
    ]);
    const section = await renderRunning(linearPlan);

    expect(
      within(section).getByText(
        /A versão 3 deste processo já foi publicada\. Este card continua na versão 1/,
      ),
    ).toBeTruthy();
  });

  it('não avisa de versão quando o card já está na última', async () => {
    seedCatalog([published({ id: 'process-1', name: 'Processo' })]);
    const section = await renderRunning(linearPlan);

    expect(within(section).queryByText(/já foi publicada/)).toBeNull();
  });

  it('escreve o andamento no singular quando o processo tem uma etapa só', async () => {
    const single = planOf([
      step({ id: 'start', kind: 'start', to: 'Única' }),
      step({ id: 'Única', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const section = await renderRunning(single);

    expect(within(section).getByText('0 de 1 etapa feita')).toBeTruthy();
    expect(
      within(cardItem('Card c1')).getByText(
        'Processo Processo: 0 de 1 etapa feita',
      ),
    ).toBeTruthy();
  });

  it('mantém a trilha recolhida enquanto o processo anda, com a contagem dos registros', async () => {
    const section = await renderRunning(linearPlan);
    const log = within(section).getByRole('group');

    expect(log.hasAttribute('open')).toBe(false);
    expect(
      within(log).getByText('Trilha da execução (1 registro)'),
    ).toBeTruthy();

    click(activeStep('a'), 'Concluir etapa');

    expect(
      within(trail()).getByText('Trilha da execução (2 registros)'),
    ).toBeTruthy();
  });
});
