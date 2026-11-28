import { act, fireEvent, screen, within } from '@testing-library/react';

import { mockReactFlow } from './react-flow-test-setup';
import {
  button,
  canvas,
  draftStatus,
  findCanvasText,
  processSelect,
  renderWorkspace,
  twoProcessCatalog,
} from './workspace-test-kit';

mockReactFlow();

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

function openMenu(processName: string) {
  fireEvent.click(button(`Ações do processo ${processName}`));
}

async function dialog(name: string) {
  return screen.findByRole('dialog', { name });
}

function optionNames() {
  return [...processSelect().options].map((item) => item.text);
}

describe('ProcessWorkspace: publicação', () => {
  it('salva o rascunho no catálogo e marca a versão com alterações', async () => {
    const { catalogStore } = await renderWorkspace();
    fireEvent.click(button('Inserir Temporizador'));

    await act(async () => {
      fireEvent.click(button('Salvar rascunho'));
    });

    expect(catalogStore.saved?.definitions[0].draftText).toContain('timer');
    expect(
      screen.getByText('Publicada v1, com alterações não publicadas'),
    ).toBeTruthy();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
  });

  it('publica a versão do processo e conta o rascunho como salvo', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });

    await act(async () => {
      fireEvent.click(button('Publicar versão'));
    });

    expect(screen.getByText('Versão 1 publicada.')).toBeTruthy();
    expect(screen.getByText('Publicada v1')).toBeTruthy();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
    expect(catalogStore.saved?.definitions[0].versions).toHaveLength(1);
    expect(button('Versões (1)').disabled).toBe(false);
  });

  it('não deixa publicar com erro e explica o motivo', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });

    fireEvent.click(button('Inserir Decisão exclusiva'));

    const publish = button('Publicar versão');
    const reason = screen.getByText(
      'Corrija os 3 erros do processo para publicar.',
    );
    expect(publish.disabled).toBe(true);
    expect(publish.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('explica que nada mudou desde a última versão', async () => {
    await renderWorkspace({ lastActive: 'process-1' });

    expect(button('Publicar versão').disabled).toBe(true);
    expect(
      screen.getByText('Não há alterações desde a versão 1.'),
    ).toBeTruthy();
  });

  it('avisa quando o navegador recusa a gravação da versão', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });
    catalogStore.failNext = true;

    await act(async () => {
      fireEvent.click(button('Publicar versão'));
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'A versão não pôde ser gravada neste navegador. A edição continua aqui.',
    );
    expect(screen.getByText('Rascunho')).toBeTruthy();
  });

  it('abre uma versão como rascunho, depois de confirmar', async () => {
    await renderWorkspace();
    fireEvent.click(button('Inserir Temporizador'));

    fireEvent.click(button('Versões (1)'));
    const versions = await dialog('Versões de Processo de exemplo');
    expect(within(versions).getByText('Versão 1')).toBeTruthy();
    fireEvent.click(
      within(versions).getByRole('button', {
        name: 'Abrir a versão 1 como rascunho',
      }),
    );
    const confirm = await dialog('Abrir a versão 1 como rascunho');
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Substituir o rascunho' }),
    );

    await findCanvasText('Primeira etapa');
    expect(within(canvas()).queryByText('Temporizador')).toBeNull();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
  });

  it('volta à lista de versões quando a substituição é cancelada', async () => {
    await renderWorkspace();

    fireEvent.click(button('Versões (1)'));
    fireEvent.click(
      within(await dialog('Versões de Processo de exemplo')).getByRole(
        'button',
        { name: 'Abrir a versão 1 como rascunho' },
      ),
    );
    const confirm = await dialog('Abrir a versão 1 como rascunho');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));

    expect(await dialog('Versões de Processo de exemplo')).toBeTruthy();
  });
});

describe('ProcessWorkspace: ações do catálogo', () => {
  it('cria um processo com nome único e abre o exemplo nele', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });

    fireEvent.click(button('Novo processo'));
    const form = await dialog('Novo processo');
    const name = within(form).getByLabelText('Nome do processo');
    fireEvent.change(name, { target: { value: 'meu PROCESSO' } });
    expect(
      within(form).getByText('Já existe um processo com este nome.'),
    ).toBeTruthy();
    expect(
      (
        within(form).getByRole('button', {
          name: 'Criar processo',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(name, { target: { value: ' Entregas ' } });
    fireEvent.click(
      within(form).getByRole('button', { name: 'Criar processo' }),
    );

    expect(processSelect().selectedOptions[0].textContent).toBe('Entregas');
    await findCanvasText('Primeira etapa');
    expect(draftStatus()).toBe('Rascunho ainda não salvo.');
  });

  it('renomeia e descreve o processo aberto', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });

    openMenu('Meu processo');
    fireEvent.click(button('Renomear processo'));
    const rename = await dialog('Renomear processo');
    fireEvent.change(within(rename).getByLabelText('Nome do processo'), {
      target: { value: 'Compras' },
    });
    fireEvent.click(within(rename).getByRole('button', { name: 'Renomear' }));
    openMenu('Compras');
    fireEvent.click(button('Editar descrição'));
    const describe = await dialog('Editar descrição');
    fireEvent.change(within(describe).getByLabelText('Descrição do processo'), {
      target: { value: 'Pedidos de material.' },
    });
    fireEvent.click(
      within(describe).getByRole('button', { name: 'Salvar descrição' }),
    );

    expect(optionNames()[0]).toBe('Compras');
    expect(screen.getByText('Pedidos de material.')).toBeTruthy();
  });

  it('duplica o processo aberto e abre a cópia', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });

    openMenu('Meu processo');
    fireEvent.click(button('Duplicar processo'));

    expect(processSelect().selectedOptions[0].textContent).toBe(
      'Meu processo (cópia)',
    );
    await findCanvasText('Etapa de compras');
  });

  it('arquiva o processo aberto, abre o vizinho e restaura pelos arquivados', async () => {
    await renderWorkspace({ catalog: twoProcessCatalog() });

    openMenu('Meu processo');
    fireEvent.click(button('Arquivar processo'));
    fireEvent.click(
      within(await dialog('Arquivar processo')).getByRole('button', {
        name: 'Arquivar',
      }),
    );
    expect(optionNames()).toEqual(['Processo de exemplo']);
    expect(processSelect().value).toBe('process-2');

    openMenu('Processo de exemplo');
    expect(button('Arquivar processo').disabled).toBe(true);
    fireEvent.click(button('Arquivados (1)'));
    const archived = await dialog('Processos arquivados');
    fireEvent.click(
      within(archived).getByRole('button', { name: 'Restaurar Meu processo' }),
    );

    expect(optionNames()).toEqual(['Meu processo', 'Processo de exemplo']);
    expect(
      within(archived).getByText('Nenhum processo arquivado.'),
    ).toBeTruthy();
    fireEvent.click(within(archived).getByRole('button', { name: 'Fechar' }));
  });

  it('avisa quando o catálogo não pode ser gravado', async () => {
    const { catalogStore } = await renderWorkspace({
      catalog: twoProcessCatalog(),
    });
    catalogStore.failNext = true;

    openMenu('Meu processo');
    fireEvent.click(button('Duplicar processo'));

    expect(
      await screen.findByText(/O catálogo de processos não pôde ser gravado/),
    ).toBeTruthy();
    expect(processSelect().selectedOptions[0].textContent).toBe(
      'Meu processo (cópia)',
    );
  });
});
