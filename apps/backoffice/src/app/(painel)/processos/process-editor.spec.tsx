import {
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { Position } from '@xyflow/react';

import { BLOCK_DRAG_TYPE } from './block-palette';
import { ProcessConnectionLine } from './connection-line';
import { sampleProcess } from './model/sample-process';
import { ProcessEditor } from './process-editor';
import { mockReactFlow } from './react-flow-test-setup';

mockReactFlow();

function canvas() {
  return screen.getByLabelText('Canvas do processo');
}

function issueStatus() {
  return screen.getByRole('status').textContent;
}

interface KeyParams {
  readonly target: Element;
  readonly init: KeyboardEventInit;
}

function key({ target, init }: Readonly<KeyParams>) {
  fireEvent.keyDown(target, init);
}

async function renderEditor() {
  render(<ProcessEditor initial={sampleProcess} />);
  await within(canvas()).findByText('Primeira etapa');
}

describe('ProcessEditor', () => {
  it('mostra biblioteca, canvas com o processo inicial e propriedades', async () => {
    await renderEditor();

    expect(
      screen.getByRole('toolbar', { name: 'Ações do editor' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Blocos' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Propriedades' })).toBeTruthy();
    expect(within(canvas()).getByText('Início')).toBeTruthy();
    expect(within(canvas()).getByText('Descreva a atividade.')).toBeTruthy();
    expect(issueStatus()).toBe('Sem problemas');
  });

  it('insere a Decisão pela biblioteca com os ramos e o painel dela', async () => {
    await renderEditor();

    fireEvent.click(
      screen.getByRole('button', { name: 'Inserir Decisão exclusiva' }),
    );

    expect(within(canvas()).getByText('Sim')).toBeTruthy();
    expect(within(canvas()).getByText('Não')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Ramos' })).toBeTruthy();
    expect(issueStatus()).toBe('3 problemas');
    expect(
      within(canvas()).getAllByText(
        /Problemas: Decisão exclusiva não tem conexão/,
      ),
    ).toHaveLength(1);
  });

  it('desfaz, refaz, duplica e exclui pelos atalhos de teclado', async () => {
    await renderEditor();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Inserir Convergência de alternativas',
      }),
    );
    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(1);

    key({ target: document.body, init: { key: 'd', ctrlKey: true } });
    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(2);

    key({ target: document.body, init: { key: 'Delete' } });
    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(1);

    key({ target: document.body, init: { key: 'z', ctrlKey: true } });
    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(2);

    key({ target: document.body, init: { key: 'y', metaKey: true } });
    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(1);
  });

  it('deixa as teclas para o campo de texto e para os botões', async () => {
    await renderEditor();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Inserir Convergência de alternativas',
      }),
    );

    key({
      target: screen.getByLabelText('Título'),
      init: { key: 'z', ctrlKey: true },
    });
    key({
      target: screen.getByRole('button', { name: 'Desfazer' }),
      init: { key: 'Delete' },
    });
    key({ target: document.body, init: { key: 'k', ctrlKey: true } });

    expect(
      within(canvas()).getAllByText('Convergência de alternativas'),
    ).toHaveLength(1);
  });

  it('edita a anotação pelo painel e desfaz pela barra', async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Inserir Anotação' }));
    expect(within(canvas()).getByText('Anotação')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Texto'), {
      target: { value: ' ' },
    });
    expect(within(canvas()).getByText('Anotação vazia')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(within(canvas()).getByText('Anotação')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refazer' }));
    expect(within(canvas()).getByText('Anotação vazia')).toBeTruthy();
  });

  it('insere o bloco solto vindo da biblioteca e ignora outros arrastes', async () => {
    await renderEditor();
    const blockDrag = {
      types: [BLOCK_DRAG_TYPE],
      dropEffect: 'none',
      getData: () => 'merge',
    };

    expect(fireEvent.dragOver(canvas(), { dataTransfer: blockDrag })).toBe(
      false,
    );
    expect(blockDrag.dropEffect).toBe('copy');
    const drop = createEvent.drop(canvas(), { dataTransfer: blockDrag });
    Object.defineProperties(drop, {
      clientX: { value: 120 },
      clientY: { value: 80 },
    });
    fireEvent(canvas(), drop);
    expect(
      within(canvas()).getByText('Convergência de alternativas'),
    ).toBeTruthy();

    const fileDrag = { types: ['Files'], getData: () => '' };
    expect(fireEvent.dragOver(canvas(), { dataTransfer: fileDrag })).toBe(true);
    expect(fireEvent.drop(canvas(), { dataTransfer: fileDrag })).toBe(true);
  });

  it('limpa o canvas, ajusta a tela e aponta a falta do Início', async () => {
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar à tela' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Limpar o canvas',
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Limpar' }));

    expect(within(canvas()).queryByText('Primeira etapa')).toBeNull();
    expect(issueStatus()).toBe('1 problema');
    expect(
      screen.getByText('O processo não tem um bloco Início.'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Limpar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('seleciona o bloco pelo teclado e mostra as propriedades dele', async () => {
    await renderEditor();
    const node = within(canvas())
      .getByText('Primeira etapa')
      .closest('.react-flow__node') as HTMLElement;

    fireEvent.keyDown(node, { key: 'Enter' });

    expect(
      (screen.getByLabelText('Descrição') as HTMLTextAreaElement).value,
    ).toBe('Descreva a atividade.');
  });
});

describe('ProcessConnectionLine', () => {
  function renderLine(status: 'valid' | 'invalid' | null) {
    const { container } = render(
      <svg>
        <title>linha</title>
        <ProcessConnectionLine
          {...({
            fromX: 0,
            fromY: 0,
            fromPosition: Position.Bottom,
            toX: 50,
            toY: 80,
            toPosition: Position.Top,
            connectionStatus: status,
          } as Parameters<typeof ProcessConnectionLine>[0])}
        />
      </svg>,
    );
    return container.querySelector('path');
  }

  it('pinta a linha conforme a conexão é aceita ou recusada', () => {
    expect(renderLine('valid')?.getAttribute('class')).toContain(
      'process-connection-line--valid',
    );
    expect(renderLine('invalid')?.getAttribute('class')).toContain('--invalid');
    expect(renderLine(null)?.getAttribute('class')).toContain('--idle');
  });
});
