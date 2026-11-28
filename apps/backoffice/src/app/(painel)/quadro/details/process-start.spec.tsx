import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  type ScriptedCatalogStore,
  scriptedCatalogStore,
  storeFailure,
} from '@/shared/process/catalog-session-test-store';
import { linearPlan } from '@/shared/process/engine-test-plans';

import type { BoardProcess } from '../model/board';
import { published } from '../process-test-kit';
import { ProcessStart } from './process-start';

type Start = (process: BoardProcess) => string | undefined;

/** Catálogo com os processos "Atendimento" e "Compra", este com duas versões publicadas. */
function catalogStore(): ScriptedCatalogStore {
  return scriptedCatalogStore({
    definitions: [
      published({ id: 'p1', name: 'Atendimento' }),
      published({ id: 'p2', name: 'Compra', versions: 2 }),
    ],
  });
}

interface RenderStartParams {
  readonly store: ScriptedCatalogStore;
  readonly start?: Start;
}

function renderStart(params: RenderStartParams) {
  const start = vi.fn<Start>(params.start ?? (() => undefined));
  render(
    <ProcessStart
      actions={{ start }}
      openLabel="Escolher processo"
      catalogStore={params.store}
    />,
  );
  return start;
}

function opener(): HTMLElement {
  return screen.getByRole('button', { name: 'Escolher processo' });
}

/** Deixa a leitura do catálogo terminar e a tela se atualizar. */
async function settled(): Promise<void> {
  await act(async () => undefined);
}

/** Abre a escolha do processo e espera a leitura do catálogo. */
async function openPicker(): Promise<void> {
  fireEvent.click(opener());
  await settled();
}

describe('ProcessStart', () => {
  it('só lê o catálogo quando a pessoa abre a escolha', async () => {
    const store = catalogStore();
    renderStart({ store });
    await settled();
    expect(store.loads).toBe(0);
    expect(opener().getAttribute('aria-expanded')).toBe('false');

    await openPicker();

    expect(store.loads).toBe(1);
    expect(opener().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Processo' })).toBeTruthy();
  });

  it('recolhe a escolha quando a pessoa aciona o botão de novo', async () => {
    renderStart({ store: catalogStore() });
    await openPicker();

    fireEvent.click(opener());

    expect(opener().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('combobox', { name: 'Processo' })).toBeNull();
  });

  it('mostra a espera enquanto o catálogo é lido', async () => {
    const store = catalogStore();
    const release = store.hold();
    renderStart({ store });

    fireEvent.click(opener());
    await settled();

    expect(screen.getByRole('status').textContent).toBe(
      'Carregando os processos…',
    );
    release();
    await settled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('mostra o motivo quando a leitura falha e lê de novo quando a pessoa pede', async () => {
    const store = catalogStore();
    store.nextLoads.push(
      storeFailure({ kind: 'unavailable', message: 'Servidor fora do ar.' }),
    );
    renderStart({ store });
    await openPicker();
    expect(screen.getByRole('alert').textContent).toContain(
      'Não foi possível carregar os processos. Servidor fora do ar.',
    );
    expect(screen.queryByRole('combobox', { name: 'Processo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await settled();

    expect(store.loads).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Processo' })).toBeTruthy();
  });

  it('na nova tentativa, leva o foco ao botão que abriu a escolha', async () => {
    const store = catalogStore();
    store.nextLoads.push(
      storeFailure({ kind: 'unavailable', message: 'Servidor fora do ar.' }),
    );
    renderStart({ store });
    await openPicker();
    const retry = screen.getByRole('button', { name: 'Tentar de novo' });
    retry.focus();

    fireEvent.click(retry);

    expect(document.activeElement).toBe(opener());
    await settled();
  });

  it('inicia o primeiro processo da lista quando a pessoa não escolhe outro', async () => {
    const start = renderStart({ store: catalogStore() });
    await openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar processo' }));

    expect(start).toHaveBeenCalledWith({
      definitionId: 'p1',
      version: 1,
      name: 'Atendimento',
      plan: linearPlan,
    });
  });

  it('inicia o processo escolhido, na última versão publicada', async () => {
    const start = renderStart({ store: catalogStore() });
    await openPicker();
    const select = screen.getByRole('combobox', { name: 'Processo' });
    expect(
      Array.from(select.querySelectorAll('option')).map(
        (option) => option.textContent,
      ),
    ).toEqual(['Atendimento (versão 1)', 'Compra (versão 2)']);

    fireEvent.change(select, { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar processo' }));

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ definitionId: 'p2', version: 2 }),
    );
  });

  it('mostra junto do botão o motivo quando o quadro recusa iniciar o processo', async () => {
    renderStart({
      store: catalogStore(),
      start: () => 'Este card já segue um processo em andamento.',
    });
    await openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar processo' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'Este card já segue um processo em andamento.',
    );
  });

  it('explica o catálogo sem processo publicado e aponta o editor de processos', async () => {
    renderStart({ store: scriptedCatalogStore({ definitions: [] }) });
    await openPicker();

    expect(screen.getByText(/Nenhum processo publicado ainda\./)).toBeTruthy();
    const editor = screen.getByRole('link', {
      name: 'Abrir o editor de processos',
    });
    expect(editor.getAttribute('href')).toBe('/processos');
  });
});
