import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { ProcessDefinition } from '@/shared/process/catalog';
import {
  type FakeDefinitionsApi,
  fakeDefinitionsApi,
} from '@/shared/process/definitions-api-fake';

import { sampleProcess } from './model/sample-process';
import { mockReactFlow } from './react-flow-test-setup';
import {
  button,
  documentText,
  draftStatus,
  findCanvasText,
  processSelect,
  renderRemoteWorkspace,
  twoProcessCatalog,
} from './workspace-test-kit';

mockReactFlow();

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

const [myProcess] = twoProcessCatalog().definitions;

/** "Meu processo" como outro cliente o deixou: com o desenho do exemplo no rascunho. */
const elsewhere: ProcessDefinition = {
  ...myProcess,
  draftText: documentText(sampleProcess),
};

function operations(api: FakeDefinitionsApi): string[] {
  return api.calls.map((call) => call.operation);
}

function storedDraft(api: FakeDefinitionsApi): string {
  const definition = api.stored('process-1')?.definition as ProcessDefinition;
  return definition.draftText ?? '';
}

async function clickAndSettle(name: string) {
  await act(async () => {
    fireEvent.click(button(name));
  });
}

/** A pessoa sai da aba e volta para ela. */
async function leaveAndComeBack() {
  await act(async () => {
    fireEvent.blur(window);
    fireEvent.focus(window);
  });
}

function conflictNotice() {
  return screen.queryByText(/foi alterado em outro lugar/);
}

/** O editor com uma alteração por salvar sobre um processo que outro cliente já regravou. */
async function editedOverStale() {
  const context = await renderRemoteWorkspace();
  context.api.put(elsewhere);
  fireEvent.click(button('Inserir Temporizador'));
  return context;
}

/** O mesmo, depois de tentar salvar: a gravação espera a escolha do conflito. */
async function inConflict() {
  const context = await editedOverStale();
  await clickAndSettle('Salvar rascunho');
  await screen.findByText(/foi alterado em outro lugar/);
  return context;
}

describe('ProcessWorkspace com a API do painel: abertura', () => {
  it('abre os processos do servidor, sem a primeira carga do navegador', async () => {
    const { api } = await renderRemoteWorkspace();

    await findCanvasText('Etapa de compras');
    const options = [...processSelect().options].map((item) => item.text);
    expect(options).toEqual(['Meu processo', 'Processo de exemplo']);
    expect(operations(api)).toEqual(['list']);
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('não cria o exemplo quando o servidor não tem processo', async () => {
    const { api } = await renderRemoteWorkspace({
      api: fakeDefinitionsApi(),
      withEditor: false,
    });

    expect(screen.getByText(/Crie um processo novo/)).toBeTruthy();
    expect(operations(api)).toEqual(['list']);
  });

  it('mostra o carregamento e, quando a leitura falha, a nova tentativa', async () => {
    const api = fakeDefinitionsApi(twoProcessCatalog().definitions);
    api.failNext({ operation: 'list', kind: 'network' });
    await renderRemoteWorkspace({ api, waitReady: false });
    expect(screen.getByRole('status').textContent).toBe('Carregando o editor…');
    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toContain(
      'Não foi possível carregar os processos.',
    );
    expect(failure.textContent).toContain(
      'Não foi possível falar com o servidor',
    );

    fireEvent.click(button('Tentar de novo'));

    await screen.findByLabelText('Canvas do processo');
    await findCanvasText('Etapa de compras');
  });

  it('avisa que o processo do endereço não existe no servidor', async () => {
    await renderRemoteWorkspace({ url: '/processos?processo=process-9' });

    expect(
      await screen.findByText(
        'O processo pedido no endereço não existe no servidor. Outro processo foi aberto no lugar.',
      ),
    ).toBeTruthy();
  });
});

describe('ProcessWorkspace com a API do painel: gravação', () => {
  it('salva o rascunho no servidor, na revisão seguinte', async () => {
    const { api } = await renderRemoteWorkspace();
    fireEvent.click(button('Inserir Temporizador'));

    await clickAndSettle('Salvar rascunho');

    expect(storedDraft(api)).toContain('timer');
    expect(api.stored('process-1')?.revision).toBe(2);
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('avisa a falha ao salvar o rascunho e salva na nova tentativa', async () => {
    const { api } = await renderRemoteWorkspace();
    fireEvent.click(button('Inserir Temporizador'));
    api.failNext({ operation: 'update', kind: 'network' });

    await clickAndSettle('Salvar rascunho');
    const afterFailure = draftStatus();
    const notice = screen.queryByText(/não pôde ser gravado/);
    await clickAndSettle('Tentar novamente');

    expect(afterFailure).toBe(
      'Falha ao salvar o rascunho. A edição continua aqui.',
    );
    expect(notice).toBeNull();
    expect(storedDraft(api)).toContain('timer');
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('avisa a falha ao publicar e publica na nova tentativa', async () => {
    const { api } = await renderRemoteWorkspace();
    api.failNext({ operation: 'update', kind: 'server' });

    await clickAndSettle('Publicar versão');
    const failure = screen.getByRole('alert').textContent;
    await clickAndSettle('Publicar versão');

    expect(failure).toBe(
      'A versão não pôde ser gravada no servidor. A edição continua aqui.',
    );
    expect(screen.getByText('Versão 1 publicada.')).toBeTruthy();
    expect(api.stored('process-1')?.revision).toBe(2);
  });

  it('avisa quando uma ação do catálogo não é gravada e grava na nova tentativa', async () => {
    const { api } = await renderRemoteWorkspace();
    api.failNext({ operation: 'create', kind: 'network' });
    fireEvent.click(button('Ações do processo Meu processo'));
    fireEvent.click(button('Duplicar processo'));
    expect(
      await screen.findByText(
        /O catálogo de processos não pôde ser gravado no servidor/,
      ),
    ).toBeTruthy();

    await clickAndSettle('Tentar de novo');

    expect(screen.queryByText(/não pôde ser gravado no servidor/)).toBeNull();
    expect(api.stored('process-3')).toBeDefined();
  });
});

describe('ProcessWorkspace com a API do painel: conflito', () => {
  it('mantém a edição na tela e oferece recarregar ou manter', async () => {
    const { api } = await inConflict();

    expect(screen.getByText(/A sua edição continua nesta tela/)).toBeTruthy();
    expect(button('Recarregar do servidor').disabled).toBe(false);
    expect(button('Manter a minha versão').disabled).toBe(false);
    expect(draftStatus()).toBe('Salvando…');
    expect(storedDraft(api)).not.toContain('timer');
  });

  it('manter grava a versão da tela por cima e conclui o salvamento', async () => {
    const { api } = await inConflict();

    await clickAndSettle('Manter a minha versão');

    await waitFor(() => expect(conflictNotice()).toBeNull());
    expect(storedDraft(api)).toContain('timer');
    expect(api.stored('process-1')?.revision).toBe(3);
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('recarregar reabre o editor com o que está no servidor e descarta a edição', async () => {
    const { api } = await inConflict();

    await clickAndSettle('Recarregar do servidor');

    await findCanvasText('Primeira etapa');
    expect(conflictNotice()).toBeNull();
    expect(storedDraft(api)).not.toContain('timer');
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('fica sem processo aberto quando o recarregar não traz nenhum', async () => {
    const { api } = await inConflict();
    api.drop('process-1');
    api.drop('process-2');

    await clickAndSettle('Recarregar do servidor');

    expect(await screen.findByText(/Crie um processo novo/)).toBeTruthy();
    expect(conflictNotice()).toBeNull();
  });

  it('continua oferecendo a escolha quando o manter não chega ao servidor', async () => {
    const { api } = await inConflict();
    api.failNext({ operation: 'update', kind: 'network' });

    await clickAndSettle('Manter a minha versão');

    expect(
      await screen.findByText(
        'A sua versão não pôde ser gravada. Tente de novo.',
      ),
    ).toBeTruthy();
    expect(conflictNotice()).not.toBeNull();
  });

  it('continua oferecendo a escolha quando o recarregar falha, e diz o motivo', async () => {
    const { api } = await inConflict();
    api.failNext({ operation: 'list', kind: 'network' });

    await clickAndSettle('Recarregar do servidor');

    expect(
      await screen.findByText(/Os processos não puderam ser recarregados/),
    ).toBeTruthy();
    expect(conflictNotice()).not.toBeNull();
    expect(draftStatus()).toBe('Salvando…');
  });

  it('tira a confirmação de troca da frente e troca depois de manter a versão', async () => {
    await editedOverStale();
    fireEvent.change(processSelect(), { target: { value: 'process-2' } });
    const dialog = await screen.findByRole('dialog', {
      name: 'Alterações não salvas',
    });

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Salvar e trocar' }),
      );
    });
    await screen.findByText(/foi alterado em outro lugar/);
    const dialogInConflict = screen.queryByRole('dialog', {
      name: 'Alterações não salvas',
    });
    await clickAndSettle('Manter a minha versão');

    expect(dialogInConflict).toBeNull();
    await waitFor(() => expect(processSelect().value).toBe('process-2'));
  });
});

describe('ProcessWorkspace com a API do painel: volta para a aba', () => {
  it('relê o catálogo e reabre o editor quando o desenho mudou em outro lugar', async () => {
    const { api } = await renderRemoteWorkspace();
    await findCanvasText('Etapa de compras');
    api.put(elsewhere);

    await leaveAndComeBack();

    await findCanvasText('Primeira etapa');
    expect(operations(api)).toEqual(['list', 'list']);
  });

  it('mantém o editor como está quando o desenho aberto não mudou', async () => {
    const { api } = await renderRemoteWorkspace();
    fireEvent.click(button('Inserir Temporizador'));
    await clickAndSettle('Salvar rascunho');
    api.put({ ...twoProcessCatalog().definitions[1], name: 'Exemplo novo' });

    await leaveAndComeBack();

    await waitFor(() =>
      expect(processSelect().options[1].text).toBe('Exemplo novo'),
    );
    expect(draftStatus()).toBe('Rascunho salvo no servidor.');
  });

  it('relê também quando não há processo aberto', async () => {
    const { api } = await renderRemoteWorkspace({
      api: fakeDefinitionsApi(),
      withEditor: false,
    });
    api.put(myProcess);

    await leaveAndComeBack();

    await findCanvasText('Etapa de compras');
    expect(operations(api)).toEqual(['list', 'list']);
  });

  it('não faz nada quando a pessoa escolhe o processo que já está aberto', async () => {
    await renderRemoteWorkspace();
    fireEvent.click(button('Inserir Temporizador'));

    fireEvent.change(processSelect(), { target: { value: 'process-1' } });

    expect(
      screen.queryByRole('dialog', { name: 'Alterações não salvas' }),
    ).toBeNull();
  });

  it('não relê com alteração não salva no editor', async () => {
    const { api } = await editedOverStale();

    await leaveAndComeBack();

    expect(operations(api)).toEqual(['list']);
    expect(draftStatus()).toBe('Alterações não salvas.');
  });

  it('abre outro processo quando o aberto saiu do servidor', async () => {
    const { api } = await renderRemoteWorkspace();
    api.drop('process-1');

    await leaveAndComeBack();

    await waitFor(() => expect(processSelect().value).toBe('process-2'));
    await findCanvasText('Primeira etapa');
  });
});
