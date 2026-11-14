import { AsyncLocalStorage } from 'node:async_hooks';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const weight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isLogLevel = (value: string): value is LogLevel =>
  Object.hasOwn(weight, value);

const threshold = (): number => {
  const configured = process.env.LOG_LEVEL?.toLowerCase() ?? 'info';
  return isLogLevel(configured) ? weight[configured] : weight.info;
};

// WHY: o requestId vive no contexto assíncrono, e não no call site: toda linha
// da mesma invocação o leva sem que quem escreve o log precise lembrar dele.
const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export const withRequestId = <T>(requestId: string, work: () => T): T =>
  requestContext.run({ requestId }, work);

// WHY: lista de permissão, e não de bloqueio: um campo novo nasce redigido e só
// aparece no log depois que alguém decide que é seguro. A lista vale em todos
// os níveis do objeto; o valor de uma chave permitida segue sendo de quem
// loga, então nunca anexe corpo de requisição, token nem dado de cartão.
const safeKeys: ReadonlySet<string> = new Set([
  // formato mínimo comum a TypeScript, Go e Quarkus
  'time',
  'level',
  'message',
  'requestId',
  // unidade de trabalho: mensagem, lote, requisição e execução agendada
  'messageId',
  'receiveCount',
  'scheduledAt',
  'method',
  'route',
  'status',
  'total',
  'failed',
  'durationMs',
  'permanent',
  // erro serializado
  'error',
  'name',
  'code',
  'stack',
  'cause',
]);

const redacted = '[redacted]';

// WHY: `JSON.stringify(new Error())` devolve `{}`; sem este tratamento o log de
// erro perderia mensagem, stack e causa. O `this` é o objeto dono da chave:
// índice de array não é nome de campo, então não passa pela lista de permissão.
function redact(this: unknown, key: string, value: unknown): unknown {
  const isFieldName = key !== '' && !Array.isArray(this);
  if (isFieldName && !safeKeys.has(key)) {
    return redacted;
  }
  return value instanceof Error
    ? {
        name: value.name,
        message: value.message,
        stack: value.stack,
        cause: value.cause,
      }
    : value;
}

// WHY: uma linha JSON por evento no stdout é o contrato de log do ADR 0008; o
// núcleo não loga, só os entrypoints.
export const log = (
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
): void => {
  if (weight[level] < threshold()) {
    return;
  }
  const time = new Date().toISOString();
  const requestId = requestContext.getStore()?.requestId;
  const context = requestId === undefined ? {} : { requestId };
  // WHY: `fields` vem antes dos campos fixos para que um campo de nome `level`,
  // `message` ou `time` não os sobrescreva; o requestId do contexto também
  // vence o que vier nos campos.
  const entry = { ...fields, ...context, level, message, time };
  let line: string;
  try {
    line = JSON.stringify(entry, redact);
  } catch {
    // WHY: referência circular ou BigInt fazem o JSON.stringify lançar; um log
    // nunca pode derrubar o handler, e com ele o lote SQS inteiro.
    line = JSON.stringify({
      ...context,
      level,
      message,
      time,
      serializationFailed: true,
    });
  }
  process.stdout.write(`${line}\n`);
};
