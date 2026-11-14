---
name: skill-ddd
description: >-
  Modelagem de domínio no núcleo puro dos serviços (`src/core` em TypeScript, `internal/core` em Go, em `apps/services`): agregados, value objects, eventos de domínio, repositórios como portas e fronteiras de contexto. Use ao modelar regra de negócio, criar entidade, agregado ou value object, publicar evento de domínio ou separar contextos. NÃO usar para estrutura de pastas e camadas (use skill-architecture-patterns) nem para traduzir erro em HTTP, Lambda ou fila (use skill-error-handling).
---

# DDD no núcleo puro

> **O repositório ainda não tem domínio de negócio.** Os serviços de exemplo só têm o `sayHello`. Os exemplos abaixo usam um `Order` **fictício** para ilustrar o padrão; não o trate como modelo do produto nem o crie em código real sem um pedido. DDD só compensa onde as regras são complexas: um handler que traduz e delega fica melhor com uma função pura, como `src/core/hello.ts`.

## Quando usar

- Modelar regras de negócio com invariantes que mudam ao longo do tempo.
- Criar agregado, value object ou evento de domínio no núcleo de um serviço.
- Decidir se duas ideias são o mesmo contexto ou dois.

## Onde o domínio mora

Tudo isto fica no núcleo, **sem import de runtime** (Lambda, HTTP, SDK da AWS), como pede `docs/adr/0008-adapters-de-runtime.md`:

| Conceito | TypeScript | Go |
| -------- | ---------- | -- |
| Agregado, entidade, value object | `src/core/<contexto>/` | `internal/core/<contexto>/` |
| Evento de domínio | junto do agregado | junto do agregado |
| Erro de domínio | `src/core/errors.ts` | `internal/core/errors.go` |
| Porta de repositório e de publicação | `type` no núcleo, em vocabulário do domínio | `interface` no pacote que a consome |
| Caso de uso | `src/core/<contexto>/<acao>.ts` | `internal/core/<contexto>/` |
| Implementação das portas (DynamoDB, SQS) | fora do núcleo (adapter) | fora do núcleo (adapter) |

O formato dos erros e a regra de import estão em `skill-error-handling` e `skill-architecture-patterns`. Exemplos em Go em `references/go.md`.

## Linguagem ubíqua e contexto

- Identificadores em inglês (`AGENTS.md`), com os termos do negócio. Texto de mensagem ao usuário em PT-BR.
- **Contexto delimitado**: um modelo, uma linguagem. Se a mesma palavra significa coisas diferentes em duas áreas, são dois contextos.
- Contexto vira **pasta** (`src/core/<contexto>/`) enquanto compartilha deploy, escala e dados; vira **serviço próprio** quando precisa dos seus.
- Contextos não importam o interior um do outro. Cruzam fronteira por **evento** ou contrato explícito, e quem traduz o modelo alheio para o seu é um adapter (camada anticorrupção).
- **Serviços não dependem de serviços** (ADR 0009): a integração entre contextos de serviços diferentes passa por recurso compartilhado de L2 (fila, tópico, barramento), cujo dono é o Terraform (regra 2 do ADR 0004), e nunca por chamada direta.

## Value object

Imutável, sem identidade, igual por valor, válido desde a construção. Operações devolvem um valor novo. Dinheiro em inteiro (centavos), nunca em ponto flutuante.

```ts
import { DomainError } from '../errors.js';

export class Money {
  readonly cents: number;
  readonly currency: string;

  private constructor(cents: number, currency: string) {
    this.cents = cents;
    this.currency = currency;
  }

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new DomainError(
        'invalid_input',
        'O valor deve ser inteiro e não negativo',
      );
    }
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new DomainError('rule_violated', 'Moedas diferentes não se somam');
    }
    return new Money(this.cents + other.cents, this.currency);
  }

  times(factor: number): Money {
    return Money.of(this.cents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }
}
```

## Agregado e eventos de domínio

Fronteira de consistência: **uma transação altera um agregado**. Regras:

- Só a raiz é acessível de fora. Estado privado; mudança por métodos que garantem as invariantes.
- Outro agregado é referenciado por **id**, não por objeto.
- Agregado pequeno: se duas partes não precisam mudar juntas, são agregados separados.
- Tempo e aleatoriedade entram por parâmetro (`now: Date`, gerador de id). O núcleo fica determinístico e o teste dispensa mock de relógio.
- O agregado **registra** os eventos; o caso de uso os publica depois de persistir.

```ts
import { DomainError } from '../errors.js';
import { Money } from './money.js';

export type OrderEvent = {
  type: 'order_placed';
  orderId: string;
  totalCents: number;
  occurredAt: string;
};

type OrderLine = { sku: string; quantity: number; unitPrice: Money };

export class Order {
  readonly id: string;
  private readonly lines: OrderLine[] = [];
  private status: 'draft' | 'placed' = 'draft';
  private pending: OrderEvent[] = [];

  private constructor(id: string) {
    this.id = id;
  }

  static draft(id: string): Order {
    return new Order(id);
  }

  addLine(sku: string, quantity: number, unitPrice: Money): void {
    if (this.status !== 'draft') {
      throw new DomainError(
        'rule_violated',
        'Pedido confirmado não aceita itens',
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError(
        'invalid_input',
        'A quantidade deve ser um inteiro positivo',
      );
    }
    this.lines.push({ sku, quantity, unitPrice });
  }

  total(currency = 'BRL'): Money {
    return this.lines.reduce(
      (sum, line) => sum.add(line.unitPrice.times(line.quantity)),
      Money.of(0, currency),
    );
  }

  place(now: Date): void {
    if (this.lines.length === 0) {
      throw new DomainError(
        'rule_violated',
        'Pedido sem itens não pode ser confirmado',
      );
    }
    this.status = 'placed';
    this.pending.push({
      type: 'order_placed',
      orderId: this.id,
      totalCents: this.total().cents,
      occurredAt: now.toISOString(),
    });
  }

  pullEvents(): OrderEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}
```

### Regras para eventos

- **Fato no passado** (`order_placed`), com dados serializáveis (string, número). Sem classe de domínio nem `Date` dentro.
- **Evento interno** (dentro do contexto) e **evento de integração** (cruza contexto ou serviço) são coisas diferentes. O de integração é contrato: versione-o e inclua um `eventId` para dedupe, gerado por uma porta de ids.
- A entrega na fila é **ao menos uma vez** (SQS padrão), então todo consumidor é idempotente.
- Salvar e publicar não é atômico. Se perder um evento é inaceitável, grave-o junto do agregado (outbox) e publique em um passo separado; do contrário, documente que a publicação é *best effort*.

## Porta e caso de uso

O caso de uso carrega, chama o domínio, persiste e publica. **Não contém regra de negócio**: ela mora no agregado. As portas são `type`s no vocabulário do domínio, sem vazar tabela, SQL ou SDK.

```ts
import { notFound } from '../errors.js';
import type { Order, OrderEvent } from './order.js';

export type OrderRepository = {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
};

export type EventPublisher = {
  publish(events: readonly OrderEvent[]): Promise<void>;
};

export type PlaceOrderDeps = {
  orders: OrderRepository;
  publisher: EventPublisher;
  now: () => Date;
};

export const placeOrder = async (
  { orders, publisher, now }: PlaceOrderDeps,
  orderId: string,
): Promise<void> => {
  const order = await orders.findById(orderId);
  if (!order) throw notFound('Pedido', orderId);

  order.place(now());
  await orders.save(order);
  await publisher.publish(order.pullEvents());
};
```

O teste usa fakes em memória e `now` fixo: sem framework, sem mock de módulo. A regra "pedido sem itens não confirma" é testada no agregado; o teste do caso de uso confere a orquestração (salvou, publicou). Quando a regra envolve **dois agregados** e não cabe em nenhum, ela vira um serviço de domínio: função pura no núcleo, sem I/O.

## Anti-padrões

| Anti-padrão | Correção |
| ----------- | -------- |
| Regra de negócio no entrypoint | Mova para o agregado ou caso de uso; o entrypoint só traduz |
| Modelo anêmico: tipo com campos públicos mutáveis e regra espalhada | Estado privado e comportamento no agregado |
| Agregado grande que carrega tudo | Divida por fronteira de consistência; referencie por id |
| Entidade com tipo do ORM ou do SDK | O adapter mapeia persistência e domínio |
| Status HTTP dentro do erro de domínio | `DomainError` com `code`; o entrypoint traduz |
| Evento mutável ou com objeto de domínio dentro | Evento é dado serializável |
| Compartilhar tipos de domínio entre contextos ou serviços | Contrato de integração próprio e camada anticorrupção |

Em núcleo pequeno, tipos imutáveis e funções puras (o estilo do `sayHello`) já são DDD suficiente. Use classe quando há estado com invariantes que evoluem.

## Checklist

- [ ] Linguagem do código alinhada ao negócio; contextos identificados.
- [ ] Value objects imutáveis, válidos no construtor, iguais por valor.
- [ ] Agregado pequeno, estado privado, outros agregados por id.
- [ ] Núcleo sem relógio, sorteio nem import de runtime.
- [ ] Eventos serializáveis, publicados depois de persistir, consumidores idempotentes.
- [ ] Portas no vocabulário do domínio; implementação fora do núcleo.
- [ ] Erros de domínio sem status HTTP.

## Veja também

- `references/go.md` (agregado, value object e portas em Go).
- `docs/adr/0008-adapters-de-runtime.md`, `docs/adr/0004-serverless-e-terraform.md` e `docs/adr/0009-camadas-e-ordem-de-implantacao.md`.
- Skills `skill-architecture-patterns` e `skill-error-handling`.
