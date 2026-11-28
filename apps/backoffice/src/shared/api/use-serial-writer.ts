import { useEffect, useRef, useState } from 'react';

import {
  createSerialWriter,
  type SerialWriter,
  type WriteOutcome,
} from './serial-writer';

export interface UseSerialWriterParams<T, R> {
  /** Envia um valor. A falha esperada vem no resultado: a função não deve rejeitar. */
  readonly write: (value: T) => Promise<R>;
  /** Espera entre a última mudança e o envio, em milissegundos; vale o valor da primeira renderização. */
  readonly delayMs?: number;
  /** Avisa o fim de cada envio, antes de o próximo começar; chamar `cancel` aqui impede o próximo. */
  readonly onSettled?: (outcome: WriteOutcome<T, R>) => void;
}

export interface SerialWriterAccess<T> {
  /** Marca o valor para envio e reinicia a espera; o mais recente vence. */
  readonly schedule: (value: T) => void;
  /** Envia agora o valor que espera e resolve quando os envios em andamento terminarem. */
  readonly flush: () => Promise<void>;
  /** Desiste do valor que espera. O envio que já saiu vai até o fim. */
  readonly cancel: () => void;
  /** Há valor esperando ou sendo enviado: a tela ainda não está igual ao servidor. */
  readonly pending: boolean;
}

/**
 * Gravação em série de um documento da tela (`createSerialWriter`), com a pendência como estado. As funções
 * devolvidas são as mesmas a cada renderização. Quando a tela sai, o valor que esperava é enviado na hora, para a
 * última mudança não se perder na troca de rota.
 */
export function useSerialWriter<T, R>(
  params: UseSerialWriterParams<T, R>,
): SerialWriterAccess<T> {
  const [pending, setPending] = useState(false);
  /** Os parâmetros da renderização mais recente, para um envio atrasado usar as funções atuais. */
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  const [writer] = useState<SerialWriter<T>>(() =>
    createSerialWriter<T, R>({
      write: (value) => latest.current.write(value),
      delayMs: params.delayMs,
      onSettled: (outcome) => latest.current.onSettled?.(outcome),
      onPendingChange: setPending,
    }),
  );

  useEffect(() => {
    return () => {
      void writer.flush();
    };
  }, [writer]);

  return {
    schedule: writer.schedule,
    flush: writer.flush,
    cancel: writer.cancel,
    pending,
  };
}
