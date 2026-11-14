# DDD em Go (`internal/core`)

Complemento de `SKILL.md`. As ideias são as mesmas; em Go mudam a forma: sem classes, com composição, e com `internal/` garantindo que o núcleo só é importável dentro do módulo do serviço. O `Order` é **fictício** (o repositório não tem domínio de negócio); os trechos compilam e passam no `go vet`.

Layout de um contexto (padrão a seguir; o `example-go` só tem `internal/core/hello.go`):

```text
internal/core/
  errors.go          erros sentinela do núcleo
  order/             um contexto = um pacote
    order.go         agregado, evento
    money.go         value object
    place.go         portas e caso de uso
cmd/<svc>/           entrypoint: traduz e liga as portas
```

## Erros sentinela

```go
package core

import "errors"

// Erros de domínio: o núcleo diz o que aconteceu; o entrypoint traduz.
var (
	ErrNotFound     = errors.New("não encontrado")
	ErrInvalidInput = errors.New("entrada inválida")
	ErrRuleViolated = errors.New("regra violada")
)
```

O acréscimo de contexto usa `%w` (`fmt.Errorf("pedido sem itens: %w", core.ErrRuleViolated)`), e quem decide o que fazer usa `errors.Is`. Veja `skill-error-handling`.

## Value object

Campos privados, receivers **por valor**, sem mutadores. O construtor garante a invariante.

```go
package order

import (
	"fmt"

	"example/svc/internal/core"
)

type Money struct {
	cents    int64
	currency string
}

func NewMoney(cents int64, currency string) (Money, error) {
	if cents < 0 {
		return Money{}, fmt.Errorf("valor negativo: %w", core.ErrInvalidInput)
	}
	return Money{cents: cents, currency: currency}, nil
}

func (m Money) Cents() int64 { return m.cents }

func (m Money) Add(other Money) (Money, error) {
	if m.currency != other.currency {
		return Money{}, fmt.Errorf("moedas diferentes: %w", core.ErrRuleViolated)
	}
	return Money{cents: m.cents + other.cents, currency: m.currency}, nil
}
```

## Agregado e eventos

Raiz com campos privados e receiver por ponteiro. Quem está fora do pacote só muda o estado pelos métodos.

```go
package order

import (
	"fmt"
	"time"

	"example/svc/internal/core"
)

type Event struct {
	Type       string
	OrderID    string
	TotalCents int64
	OccurredAt time.Time
}

type line struct {
	sku       string
	quantity  int
	unitCents int64
}

type Order struct {
	id      string
	lines   []line
	placed  bool
	pending []Event
}

func Draft(id string) *Order { return &Order{id: id} }

func (o *Order) AddLine(sku string, quantity int, unitCents int64) error {
	if o.placed {
		return fmt.Errorf("pedido confirmado não aceita itens: %w", core.ErrRuleViolated)
	}
	if quantity <= 0 || unitCents < 0 {
		return fmt.Errorf("quantidade e valor inválidos: %w", core.ErrInvalidInput)
	}
	o.lines = append(o.lines, line{sku, quantity, unitCents})
	return nil
}

func (o *Order) Place(now time.Time) error {
	if len(o.lines) == 0 {
		return fmt.Errorf("pedido sem itens: %w", core.ErrRuleViolated)
	}
	var total int64
	for _, l := range o.lines {
		total += int64(l.quantity) * l.unitCents
	}
	o.placed = true
	o.pending = append(o.pending, Event{"order_placed", o.id, total, now})
	return nil
}

func (o *Order) PullEvents() []Event {
	events := o.pending
	o.pending = nil
	return events
}
```

Convenções: `now` entra por parâmetro; campo exportado de agregado quebra a invariante, então não exporte; slice devolvido para fora deve ser cópia (`PullEvents` entrega a posse e zera o interno).

## Portas e caso de uso

Em Go a interface fica **no pacote que a consome** (o núcleo), pequena, só com o que o caso de uso usa. O adapter (DynamoDB, SQS) vive fora de `internal/core` e a satisfaz implicitamente.

```go
package order

import (
	"context"
	"fmt"
	"time"

	"example/svc/internal/core"
)

type Repository interface {
	FindByID(ctx context.Context, id string) (*Order, error)
	Save(ctx context.Context, o *Order) error
}

type Publisher interface {
	Publish(ctx context.Context, events []Event) error
}

type PlaceOrder struct {
	orders    Repository
	publisher Publisher
	now       func() time.Time
}

func NewPlaceOrder(orders Repository, publisher Publisher, now func() time.Time) *PlaceOrder {
	return &PlaceOrder{orders: orders, publisher: publisher, now: now}
}

func (uc *PlaceOrder) Execute(ctx context.Context, id string) error {
	o, err := uc.orders.FindByID(ctx, id)
	if err != nil {
		return fmt.Errorf("carregar pedido: %w", err)
	}
	if o == nil {
		return fmt.Errorf("pedido %s: %w", id, core.ErrNotFound)
	}
	if err := o.Place(uc.now()); err != nil {
		return err
	}
	if err := uc.orders.Save(ctx, o); err != nil {
		return fmt.Errorf("salvar pedido: %w", err)
	}
	return uc.publisher.Publish(ctx, o.PullEvents())
}
```

O entrypoint (`cmd/<svc>`) monta as portas com os adapters reais e chama `Execute`; o teste (`*_test.go` ao lado) usa fakes em memória.

## Armadilhas

- Campo exportado em agregado ou value object deixa qualquer chamador violar a invariante.
- Compartilhar ponteiro de estado mutável entre goroutines sem `sync` ou canal.
- Interface "gorda" no consumidor: declare só os métodos que o caso de uso chama.
- Value object com receiver por ponteiro e mutador deixa de ser value object.
- Pacote `core/<contexto>` importando `cmd/` ou um adapter: o compilador pega o ciclo, mas o desenho já está errado.
