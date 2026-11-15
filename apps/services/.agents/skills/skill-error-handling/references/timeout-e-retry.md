# Timeout e erro de dependência (TypeScript)

Complemento de `SKILL.md`. **Status: padrão a seguir.** O trecho compila em `strict` e o comportamento do timeout foi verificado no Node 24: `AbortSignal.timeout(ms)` faz o `fetch` rejeitar com um `DOMException` de nome `TimeoutError`.

## Adapter de saída

Falha de infraestrutura (rede, SDK, HTTP 5xx) **não** é `DomainError`. O adapter a embrulha em um erro próprio, guardando a causa; o entrypoint trata como inesperado (500 na API, falha de item na fila) e retentável.

```ts
export class DependencyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DependencyError';
  }
}

export const fetchJson = async (
  url: string,
  timeoutMs = 5_000,
): Promise<unknown> => {
  // WHY: só o host vai para a mensagem; a URL completa pode carregar token.
  const { host } = new URL(url);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new DependencyError(`HTTP ${response.status} em ${host}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DependencyError) throw error;
    throw new DependencyError(`Falha ao chamar ${host}`, { cause: error });
  }
};
```

## Notas

- O `catch` embrulha qualquer erro, inclusive o `TimeoutError`, e a `cause` preserva o original para o log. O corpo da resposta ao cliente continua genérico.
- O timeout da chamada deve ser menor que o `timeout` da função no `serverless.yml`; sobra tempo para registrar o erro e responder.
- O AWS SDK já tem retry com backoff: ajuste `maxAttempts` no cliente em vez de repetir a chamada por fora.
- Retry só de operação idempotente. Para operação que não é, falhe e deixe a fila reentregar a mensagem.
