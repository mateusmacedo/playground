import { test as base } from '@playwright/test';

import { MOCK_ADDRESS } from './mock-address';
import { createScenarioSwitch, type ScenarioSwitch } from './mock-scenario';
import { createMockServer, type MockServer } from './mock-server';

export interface MockFixtures {
  /** O mock, já de volta aos dados iniciais quando o teste começa. */
  readonly mock: MockServer;
  /** Liga `slow`, `error` ou `unavailable` só nas chamadas da página do teste à API. */
  readonly mockScenario: ScenarioSwitch;
}

/** O `test` dos specs que dependem dos dados da API: importe-o no lugar do `test` do Playwright. */
export const test = base.extend<MockFixtures>({
  mock: [
    async ({ request }, use) => {
      const mock = createMockServer({ request, address: MOCK_ADDRESS });
      await mock.reset();
      await use(mock);
    },
    // WHY: o estado do mock é um só para a suíte inteira; sem `auto`, o teste que não pede `mock` herdaria os dados do
    // teste anterior.
    { auto: true },
  ],
  mockScenario: async ({ page }, use) => {
    await use(createScenarioSwitch({ page, apiUrl: MOCK_ADDRESS.apiUrl }));
  },
});
