import { within } from '@testing-library/react';

import { step } from '@/shared/process/engine-test-kit';
import { planAround, reviewFields } from '@/shared/process/engine-test-plans';

import type { BoardCard } from './model/board';
import {
  boardProcess,
  delegatedPair,
  processBoard,
} from './model/process-test-data';
import {
  activeStep,
  freezeClock,
  openProcessOf,
  releaseClock,
} from './process-test-kit';
import { renderStoredBoard } from './stored-board-test-kit';

const WAITS_HERE =
  /O card filho já foi concluído\. A etapa continua aberta porque pede campo obrigatório ou uma escolha: resolva-a aqui\./;

const review = step({
  id: 'Revisar',
  to: 'done',
  data: { fields: reviewFields },
});
const plan = planAround(review);

interface ChildPlace {
  readonly doing?: (child: BoardCard) => readonly BoardCard[];
  readonly done?: (child: BoardCard) => readonly BoardCard[];
}

/** Abre o card dono da etapa "Revisar", entregue a um card filho que está na coluna escolhida. */
async function openOwnerWithChild(place: ChildPlace): Promise<HTMLElement> {
  const pair = delegatedPair({
    ownerId: 'c1',
    childId: 'c2',
    stepRef: 'Revisar',
    plan,
  });
  await renderStoredBoard(
    processBoard({
      todo: [pair.owner],
      doing: place.doing?.(pair.child),
      done: place.done?.(pair.child),
      processes: [boardProcess(plan)],
    }),
  );
  await openProcessOf('Card c1');
  return activeStep('Revisar');
}

describe('KanbanBoard: card filho da etapa já concluído', () => {
  beforeEach(freezeClock);
  afterEach(releaseClock);

  it('explica que a etapa com campo obrigatório continua aberta depois de o card filho ser concluído', async () => {
    const item = await openOwnerWithChild({ done: (child) => [child] });

    expect(within(item).getByText('(Concluído)')).toBeTruthy();
    expect(within(item).getByText(WAITS_HERE)).toBeTruthy();
    expect(
      within(item).getByRole('button', { name: 'Concluir etapa' }),
    ).toBeTruthy();
  });

  it('não mostra o aviso enquanto o card filho não chegou à coluna de conclusão', async () => {
    const item = await openOwnerWithChild({ doing: (child) => [child] });

    expect(within(item).getByText('(Em andamento)')).toBeTruthy();
    expect(within(item).queryByText(WAITS_HERE)).toBeNull();
  });
});
