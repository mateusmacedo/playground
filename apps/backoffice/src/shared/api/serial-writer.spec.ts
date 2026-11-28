import {
  createSerialWriter,
  DEFAULT_WRITE_DELAY_MS,
  type SerialWriterParams,
} from './serial-writer';

const DELAY = 200;

interface Sending {
  readonly value: string;
  /** Conclui o envio com este resultado. */
  readonly finish: (result: string) => void;
  /** Faz o envio rejeitar. */
  readonly fail: (error: Error) => void;
}

interface Harness {
  /** Os envios feitos, na ordem; cada um fica em andamento até o teste concluí-lo. */
  readonly sendings: Sending[];
  readonly write: (value: string) => Promise<string>;
}

function harness(): Harness {
  const sendings: Sending[] = [];
  const write = (value: string) =>
    new Promise<string>((resolve, reject) => {
      sendings.push({ value, finish: resolve, fail: reject });
    });
  return { sendings, write };
}

type WriterOptions = Partial<SerialWriterParams<string, string>>;

function writerOf(options: WriterOptions = {}) {
  const { sendings, write } = harness();
  const writer = createSerialWriter<string, string>({
    write,
    delayMs: DELAY,
    ...options,
  });
  return { sendings, writer };
}

const sentValues = (sendings: readonly Sending[]) =>
  sendings.map((sending) => sending.value);

describe('createSerialWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('espera o intervalo antes de enviar', async () => {
    const { sendings, writer } = writerOf();

    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(sendings).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(sentValues(sendings)).toEqual(['a']);
  });

  it('espera 400 ms quando nenhum intervalo é informado', async () => {
    const { sendings, write } = harness();
    const writer = createSerialWriter({ write });

    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DEFAULT_WRITE_DELAY_MS - 1);
    expect(sendings).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(DEFAULT_WRITE_DELAY_MS).toBe(400);
    expect(sentValues(sendings)).toEqual(['a']);
  });

  it('junta as mudanças do intervalo num envio só, com o valor mais recente', async () => {
    const { sendings, writer } = writerOf();

    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    writer.schedule('b');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    writer.schedule('c');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(sentValues(sendings)).toEqual(['c']);
  });

  it('não faz dois envios ao mesmo tempo: o seguinte espera o anterior terminar', async () => {
    const { sendings, writer } = writerOf();
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);

    writer.schedule('b');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(sentValues(sendings)).toEqual(['a']);
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(sentValues(sendings)).toEqual(['a', 'b']);
  });

  it('descarta o valor que esperava atrás de um envio quando chega outro mais recente', async () => {
    const { sendings, writer } = writerOf();
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);

    writer.schedule('b');
    writer.schedule('c');
    await vi.advanceTimersByTimeAsync(DELAY);
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(sentValues(sendings)).toEqual(['a', 'c']);
  });

  it('respeita o intervalo do valor marcado enquanto o envio anterior terminava', async () => {
    const { sendings, writer } = writerOf();
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);

    writer.schedule('b');
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(sentValues(sendings)).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1);

    expect(sentValues(sendings)).toEqual(['a', 'b']);
  });

  it('flush envia na hora o valor que espera e resolve quando o envio termina', async () => {
    const { sendings, writer } = writerOf();
    const flushed = vi.fn();
    writer.schedule('a');

    writer.flush().then(flushed);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentValues(sendings)).toEqual(['a']);
    expect(flushed).not.toHaveBeenCalled();
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(flushed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flush durante um envio espera esse envio e o do valor que estava na fila', async () => {
    const { sendings, writer } = writerOf();
    const flushed = vi.fn();
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);
    writer.schedule('b');

    writer.flush().then(flushed);
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);
    expect(sentValues(sendings)).toEqual(['a', 'b']);
    expect(flushed).not.toHaveBeenCalled();
    sendings[1].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(flushed).toHaveBeenCalledOnce();
  });

  it('flush sem nada pendente resolve sem enviar', async () => {
    const { sendings, writer } = writerOf();

    await writer.flush();

    expect(sendings).toHaveLength(0);
  });

  it('cancel desiste do valor que espera', async () => {
    const { sendings, writer } = writerOf();
    writer.schedule('a');

    writer.cancel();
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(sendings).toHaveLength(0);
    expect(writer.isPending()).toBe(false);
  });

  it('cancel deixa terminar o envio que já saiu', async () => {
    const onSettled = vi.fn();
    const { sendings, writer } = writerOf({ onSettled });
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);
    writer.schedule('b');

    writer.cancel();
    expect(writer.isPending()).toBe(true);
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(sentValues(sendings)).toEqual(['a']);
    expect(onSettled).toHaveBeenCalledWith({ value: 'a', result: 'ok' });
    expect(writer.isPending()).toBe(false);
  });

  it('avisa o fim de cada envio com o valor enviado e o resultado', async () => {
    const onSettled = vi.fn();
    const { sendings, writer } = writerOf({ onSettled });
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);

    sendings[0].finish('gravado');
    await vi.advanceTimersByTimeAsync(0);

    expect(onSettled).toHaveBeenCalledExactlyOnceWith({
      value: 'a',
      result: 'gravado',
    });
  });

  it('não envia o próximo valor quando o aviso do fim do envio cancela', async () => {
    const { sendings, write } = harness();
    const writer = createSerialWriter<string, string>({
      write,
      delayMs: DELAY,
      onSettled: () => writer.cancel(),
    });
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);
    writer.schedule('b');
    await vi.advanceTimersByTimeAsync(DELAY);

    sendings[0].finish('conflito');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(sentValues(sendings)).toEqual(['a']);
    expect(writer.isPending()).toBe(false);
  });

  it('avisa a pendência ao marcar um valor e de novo quando tudo foi enviado', async () => {
    const onPendingChange = vi.fn();
    const { sendings, writer } = writerOf({ onPendingChange });

    writer.schedule('a');
    writer.schedule('b');
    expect(onPendingChange.mock.calls).toEqual([[true]]);
    expect(writer.isPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(writer.isPending()).toBe(true);
    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(writer.isPending()).toBe(false);
  });

  it('segue pendente entre um envio e o do valor que ainda espera o intervalo', async () => {
    const onPendingChange = vi.fn();
    const { sendings, writer } = writerOf({ onPendingChange });
    writer.schedule('a');
    await vi.advanceTimersByTimeAsync(DELAY);
    writer.schedule('b');

    sendings[0].finish('ok');
    await vi.advanceTimersByTimeAsync(0);

    expect(onPendingChange.mock.calls).toEqual([[true]]);
    expect(writer.isPending()).toBe(true);
  });

  it('não trava quando o envio rejeita: o flush rejeita e o valor seguinte é enviado', async () => {
    const { sendings, writer } = writerOf();
    writer.schedule('a');
    const flushed = writer.flush();
    const rejection = expect(flushed).rejects.toThrow('falhou');
    await vi.advanceTimersByTimeAsync(0);

    sendings[0].fail(new Error('falhou'));
    await rejection;
    expect(writer.isPending()).toBe(false);
    writer.schedule('b');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(sentValues(sendings)).toEqual(['a', 'b']);
  });
});
