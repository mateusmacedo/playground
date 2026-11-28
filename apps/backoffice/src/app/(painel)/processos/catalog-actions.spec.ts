import type { CatalogResult, ProcessCatalog } from '@/shared/process/catalog';
import {
  testDefinition,
  testVersion,
} from '@/shared/process/catalog-test-data';

import {
  type CatalogActionsWorkspace,
  createCatalogActions,
} from './catalog-actions';

interface FakeWorkspace extends CatalogActionsWorkspace {
  catalog: ProcessCatalog;
}

function fakeWorkspace(
  overrides: Partial<CatalogActionsWorkspace> = {},
): FakeWorkspace {
  const first = testDefinition({ versions: [testVersion(1)] });
  const second = testDefinition({ id: 'process-2', name: 'Compras' });
  const workspace: FakeWorkspace = {
    catalog: { definitions: [first, second] },
    active: first,
    live: [first, second],
    openProcess: vi.fn(),
    requestGuarded: vi.fn((run: () => void) => run()),
    showNotice: vi.fn(),
    remount: vi.fn(),
    access: {
      update: <R extends CatalogResult>(
        change: (catalog: ProcessCatalog) => R,
      ) => {
        const result = change(workspace.catalog);
        if (result.ok) {
          workspace.catalog = result.catalog;
        }
        return result;
      },
    },
    ...overrides,
  };
  return workspace;
}

describe('createCatalogActions', () => {
  it('não mexe no catálogo sem processo aberto', () => {
    const workspace = fakeWorkspace({ active: undefined });
    const before = workspace.catalog;
    const actions = createCatalogActions(workspace);

    actions.rename('Novo nome');
    actions.duplicate();
    actions.archive();
    actions.openVersion(testVersion(1));

    expect(workspace.catalog).toBe(before);
    expect(workspace.remount).not.toHaveBeenCalled();
  });

  it('avisa a recusa do catálogo em vez de mudar', () => {
    const workspace = fakeWorkspace();
    const actions = createCatalogActions(workspace);

    actions.rename('Compras');
    actions.create('compras');

    expect(workspace.showNotice).toHaveBeenNthCalledWith(
      1,
      'Já existe um processo com este nome.',
    );
    expect(workspace.showNotice).toHaveBeenCalledTimes(2);
    expect(workspace.openProcess).not.toHaveBeenCalled();
  });

  it('avisa quando o processo aberto sumiu do catálogo', () => {
    const workspace = fakeWorkspace();
    workspace.catalog = { definitions: [] };
    const actions = createCatalogActions(workspace);

    actions.duplicate();

    expect(workspace.showNotice).toHaveBeenCalledWith(
      'Processo não encontrado no catálogo.',
    );
  });

  it('espera a confirmação antes de criar, duplicar e arquivar', () => {
    const workspace = fakeWorkspace({ requestGuarded: vi.fn() });
    const before = workspace.catalog;
    const actions = createCatalogActions(workspace);

    actions.create('Entregas');
    actions.duplicate();
    actions.archive();

    expect(workspace.requestGuarded).toHaveBeenCalledTimes(3);
    expect(workspace.catalog).toBe(before);
  });

  it('arquiva o único processo sem abrir outro', () => {
    const first = testDefinition();
    const workspace = fakeWorkspace({ active: first, live: [first] });
    const actions = createCatalogActions(workspace);

    actions.archive();

    expect(workspace.catalog.definitions[0].archived).toBe(true);
    expect(workspace.openProcess).not.toHaveBeenCalled();
  });

  it('troca o rascunho pela versão e reabre o editor', () => {
    const workspace = fakeWorkspace();
    const actions = createCatalogActions(workspace);

    actions.openVersion(testVersion(1));

    expect(workspace.catalog.definitions[0].draftText).toBe('documento v1');
    expect(workspace.remount).toHaveBeenCalledTimes(1);
  });
});
