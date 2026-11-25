import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { DraftStore } from './draft-store';
import { sampleProcess } from './model/sample-process';
import { ProcessEditor } from './process-editor';
import { mockReactFlow } from './react-flow-test-setup';

mockReactFlow();

interface MemoryStore extends DraftStore {
  saved: string | null;
  failNext: boolean;
}

function memoryStore(saved: string | null = null): MemoryStore {
  const store: MemoryStore = {
    saved,
    failNext: false,
    load: () => store.saved,
    async save(text) {
      if (store.failNext) {
        store.failNext = false;
        throw new Error('cota cheia');
      }
      store.saved = text;
    },
  };
  return store;
}

function draftStatus() {
  return screen.getByText(/rascunho|Alterações|Salvando/i, {
    selector: '[role="status"]',
  }).textContent;
}

function canvas() {
  return screen.getByLabelText('Canvas do processo');
}

async function saveDraft() {
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: /Salvar rascunho|Tentar novamente/ }),
    );
  });
}

describe('rascunho do editor', () => {
  it('salva um processo incompleto, sobrevive à falha e reabre igual', async () => {
    const store = memoryStore();
    const { unmount } = render(
      <ProcessEditor initial={sampleProcess} store={store} />,
    );
    await within(canvas()).findByText('Primeira etapa');
    expect(draftStatus()).toBe('Rascunho ainda não salvo.');

    fireEvent.click(
      screen.getByRole('button', { name: 'Inserir Temporizador' }),
    );
    expect(
      screen.getByRole('toolbar', { name: 'Ações do editor' }),
    ).toBeTruthy();

    store.failNext = true;
    await saveDraft();
    expect(draftStatus()).toBe(
      'Falha ao salvar o rascunho. A edição continua aqui.',
    );
    expect(within(canvas()).getByText('Temporizador')).toBeTruthy();
    expect(store.saved).toBeNull();

    await saveDraft();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
    expect(store.saved).toContain('timer');

    unmount();
    render(<ProcessEditor initial={sampleProcess} store={store} />);
    await within(canvas()).findByText('Temporizador');
    expect(within(canvas()).getByText('Primeira etapa')).toBeTruthy();
    expect(draftStatus()).toBe('Rascunho salvo neste navegador.');
  });

  it('marca alteração pendente depois de editar o rascunho salvo', async () => {
    const store = memoryStore();
    render(<ProcessEditor initial={sampleProcess} store={store} />);
    await within(canvas()).findByText('Primeira etapa');
    await saveDraft();

    fireEvent.click(screen.getByRole('button', { name: 'Inserir Etapa' }));

    expect(draftStatus()).toBe('Alterações não salvas.');
  });

  it('avisa quando o rascunho salvo não pode ser lido', async () => {
    render(
      <ProcessEditor
        initial={sampleProcess}
        store={memoryStore('{quebrado')}
      />,
    );

    expect(await screen.findByText(/não pôde ser lido/)).toBeTruthy();
    expect(within(canvas()).getByText('Primeira etapa')).toBeTruthy();
  });
});
