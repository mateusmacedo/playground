/** Um envio que terminou: o valor enviado e o que o envio devolveu. */
export interface WriteOutcome<T, R> {
  readonly value: T;
  readonly result: R;
}

export interface SerialWriterParams<T, R> {
  /** Envia um valor. A falha esperada vem no resultado: a função não deve rejeitar. */
  readonly write: (value: T) => Promise<R>;
  /** Espera entre a última mudança e o envio, em milissegundos; as mudanças feitas nesse intervalo viram um envio só. */
  readonly delayMs?: number;
  /** Avisa o fim de cada envio, antes de o próximo começar; chamar `cancel` aqui impede o próximo. */
  readonly onSettled?: (outcome: WriteOutcome<T, R>) => void;
  /** Avisa quando passa a haver, e quando deixa de haver, valor esperando ou sendo enviado. */
  readonly onPendingChange?: (pending: boolean) => void;
}

export interface SerialWriter<T> {
  /** Marca o valor para envio e reinicia a espera. O valor que ainda esperava é descartado: o mais recente vence. */
  readonly schedule: (value: T) => void;
  /** Envia agora o valor que espera, sem aguardar o intervalo, e resolve quando os envios em andamento terminarem. */
  readonly flush: () => Promise<void>;
  /** Desiste do valor que espera. O envio que já saiu vai até o fim. */
  readonly cancel: () => void;
  /** Há valor esperando ou sendo enviado. */
  readonly isPending: () => boolean;
}

export const DEFAULT_WRITE_DELAY_MS = 400;

interface Waiting<T> {
  readonly value: T;
}

/**
 * Gravação em série: um envio por vez, na ordem, e só o valor mais recente de cada intervalo é enviado. Serve a um
 * documento que muda muitas vezes seguidas e é gravado inteiro, em que enviar cada mudança seria desperdício e dois
 * envios ao mesmo tempo chegariam fora de ordem.
 */
export function createSerialWriter<T, R>(
  params: SerialWriterParams<T, R>,
): SerialWriter<T> {
  const { write, onSettled, onPendingChange } = params;
  const delayMs = params.delayMs ?? DEFAULT_WRITE_DELAY_MS;
  let waiting: Waiting<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> | null = null;
  let pending = false;

  const announce = (): void => {
    const next = waiting !== null || writing !== null;
    if (next !== pending) {
      pending = next;
      onPendingChange?.(next);
    }
  };

  const stopTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const writeWaiting = async (): Promise<void> => {
    try {
      // NOTE: com o temporizador ligado, o valor que espera ainda está dentro do intervalo dele: quem o envia é o
      // disparo do temporizador, não este laço.
      while (waiting !== null && timer === null) {
        const { value } = waiting;
        waiting = null;
        const result = await write(value);
        onSettled?.({ value, result });
      }
    } finally {
      writing = null;
      announce();
    }
  };

  const start = (): Promise<void> => {
    if (writing === null && waiting !== null) {
      // WHY: o laço começa numa microtarefa para `writing` já estar preenchido quando ele terminar e o zerar; se
      // rodasse aqui, um envio que falha na hora zeraria antes da atribuição.
      writing = Promise.resolve().then(writeWaiting);
    }
    return writing ?? Promise.resolve();
  };

  return {
    schedule(value) {
      waiting = { value };
      stopTimer();
      timer = setTimeout(() => {
        timer = null;
        void start();
      }, delayMs);
      announce();
    },
    flush() {
      stopTimer();
      return start();
    },
    cancel() {
      stopTimer();
      waiting = null;
      announce();
    },
    isPending: () => pending,
  };
}
