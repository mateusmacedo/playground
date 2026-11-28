import { act, fireEvent, screen, within } from '@testing-library/react';

import { SAMPLE_PROCESS_NAME } from './catalog-seed';
import { mockReactFlow } from './react-flow-test-setup';
import {
  button,
  canvas,
  documentText,
  draftStatus,
  findCanvasText,
  processSelect,
  purchaseGraph,
  renderWorkspace,
  twoProcessCatalog,
} from './workspace-test-kit';

mockReactFlow();

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('ProcessWorkspace: abertura', () => {
  it('cria o catálogo na primeira carga e abre o exemplo publicado', async () => {
    const { catalogStore } = await renderWorkspace();

    await findCanvasText('Primeira etapa');
    expect(processSelect().selectedOptions[0].textContent).toBe(
      SAMPLE_PROCESS_NAME,
    );
    expect(screen.getByText('Publicada v1')).toBeTruthy();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
    expect(catalogStore.saved?.definitions).toHaveLength(1);
    expect(window.location.search).toBe('?processo=process-1');
  });

  it('leva o rascunho antigo para o catálogo e abre ele', async () => {
    await renderWorkspace({ legacy: documentText(purchaseGraph) });

    await findCanvasText('Etapa de compras');
    const options = [...processSelect().options].map((item) => item.text);
    expect(options).toEqual(['Meu processo', SAMPLE_PROCESS_NAME]);
    expect(screen.getByText('Rascunho')).toBeTruthy();
  });

  it('avisa quando o rascunho antigo não pode ser lido e abre o exemplo', async () => {
    await renderWorkspace({ legacy: '{quebrado' });

    expect(await screen.findByText(/não pôde ser lido/)).toBeTruthy();
    await findCanvasText('Primeira etapa');
  });

  it('abre o processo pedido no endereço', async () => {
    await renderWorkspace({
      catalog: twoProcessCatalog(),
      url: '/processos?processo=process-2',
    });

    expect(processSelect().value).toBe('process-2');
    await findCanvasText('Primeira etapa');
  });

  it('avisa quando o processo do endereço não existe e abre o primeiro', async () => {
    await renderWorkspace({
      catalog: twoProcessCatalog(),
      url: '/processos?processo=process-9',
    });

    expect(screen.getByText(/não existe neste navegador/)).toBeTruthy();
    expect(processSelect().value).toBe('process-1');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/não existe neste navegador/)).toBeNull();
  });

  it('volta ao processo aberto por último nesta aba', async () => {
    await renderWorkspace({
      catalog: twoProcessCatalog(),
      lastActive: 'process-2',
    });

    expect(processSelect().value).toBe('process-2');
  });

  it('explica o que fazer quando não há processo ativo para abrir', async () => {
    const catalog = twoProcessCatalog();
    await renderWorkspace({
      catalog: {
        definitions: catalog.definitions.map((item) => ({
          ...item,
          archived: true,
        })),
      },
      withEditor: false,
    });

    expect(screen.getByText(/Nenhum processo aberto\./)).toBeTruthy();
    expect(button('Arquivados (2)')).toBeTruthy();
  });
});

describe('ProcessWorkspace: troca de processo', () => {
  it('troca direto quando não há alteração e lembra o aberto', async () => {
    const { lastActive } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });

    fireEvent.change(processSelect(), { target: { value: 'process-2' } });

    await findCanvasText('Primeira etapa');
    expect(within(canvas()).queryByText('Etapa de compras')).toBeNull();
    expect(lastActive()).toBe('process-2');
    expect(window.location.search).toBe('?processo=process-2');
  });

  it('pede confirmação com alteração não salva e cancela sem trocar', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });
    fireEvent.click(button('Inserir Temporizador'));

    fireEvent.change(processSelect(), { target: { value: 'process-2' } });
    const dialog = await screen.findByRole('dialog', {
      name: 'Alterações não salvas',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(processSelect().value).toBe('process-1');
    expect(within(canvas()).getByText('Temporizador')).toBeTruthy();
  });

  it('troca sem salvar e descarta a alteração', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });
    fireEvent.click(button('Inserir Temporizador'));

    fireEvent.change(processSelect(), { target: { value: 'process-2' } });
    const dialog = await screen.findByRole('dialog', {
      name: 'Alterações não salvas',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Trocar sem salvar' }),
    );

    expect(processSelect().value).toBe('process-2');
    expect(catalogStore.saved?.definitions[0].draftText).not.toContain('timer');
  });

  it('salva o rascunho e troca', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });
    fireEvent.click(button('Inserir Temporizador'));

    fireEvent.change(processSelect(), { target: { value: 'process-2' } });
    const dialog = await screen.findByRole('dialog', {
      name: 'Alterações não salvas',
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar e trocar' }),
      );
    });

    expect(processSelect().value).toBe('process-2');
    expect(catalogStore.saved?.definitions[0].draftText).toContain('timer');
  });

  it('fica no processo quando o salvamento antes da troca falha', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });
    fireEvent.click(button('Inserir Temporizador'));
    catalogStore.failNext = true;

    fireEvent.change(processSelect(), { target: { value: 'process-2' } });
    const dialog = await screen.findByRole('dialog', {
      name: 'Alterações não salvas',
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar e trocar' }),
      );
    });

    expect(processSelect().value).toBe('process-1');
    expect(draftStatus()).toBe(
      'Falha ao salvar o rascunho. A edição continua aqui.',
    );
  });
});
