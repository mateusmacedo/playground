import type { Page, Route } from '@playwright/test';

const SCENARIO_HEADER = 'x-mock-scenario';

/** `slow` atrasa só as respostas de sucesso; `error` responde 500 e `unavailable`, 503. */
export type MockScenario = 'slow' | 'error' | 'unavailable';

export interface ScenarioSwitch {
  /** Liga o cenário nas próximas chamadas da página à API, no lugar do que estiver ligado. */
  readonly start: (scenario: MockScenario) => Promise<void>;
  /** Volta as chamadas da página à API ao normal. */
  readonly stop: () => Promise<void>;
}

export interface ScenarioSwitchParams {
  readonly page: Page;
  /** Endereço base da API, sem barra no fim. */
  readonly apiUrl: string;
}

type RouteHandler = (route: Route) => Promise<void>;

// WHY: o cabeçalho entra só nas chamadas ao endereço da API; mandá-lo em todas as requisições da página o levaria
// também ao servidor do painel, que não é o mock.
export function createScenarioSwitch({
  page,
  apiUrl,
}: ScenarioSwitchParams): ScenarioSwitch {
  const apiPrefix = `${apiUrl}/`;
  const isApiCall = (url: URL): boolean => url.href.startsWith(apiPrefix);
  let active: RouteHandler | null = null;

  async function stop(): Promise<void> {
    if (active === null) {
      return;
    }
    await page.unroute(isApiCall, active);
    active = null;
  }

  async function start(scenario: MockScenario): Promise<void> {
    await stop();
    const handler: RouteHandler = (route) =>
      route.continue({
        headers: { ...route.request().headers(), [SCENARIO_HEADER]: scenario },
      });
    await page.route(isApiCall, handler);
    active = handler;
  }

  return { start, stop };
}
