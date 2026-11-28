import { request } from '@playwright/test';

import { MOCK_ADDRESS } from './mock-address';
import { assertMockIsUp } from './mock-server';

// WHY: o painel do e2e lê e grava na API; sem o mock toda tela cairia no estado de erro, e a suíte falharia teste a
// teste sem dizer a causa. NOTE: o Playwright exige o export default neste arquivo.
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext();
  try {
    await assertMockIsUp({ request: context, address: MOCK_ADDRESS });
  } finally {
    await context.dispose();
  }
}
