# Interfaces e tipos em Go

Complemento do [`SKILL.md`](../SKILL.md). A regra de fundo é a hexagonal do repositório: o núcleo declara o que precisa, o adapter satisfaz.

## Interface no consumidor (porta)

A interface mora em `internal/core`, ao lado de quem a usa, com **só os métodos que o caso de uso chama**. O adapter (em `cmd/<svc>` ou em pacote próprio) devolve uma struct concreta e satisfaz a interface implicitamente, sem importar o núcleo.

```go
// internal/core: a porta
type OrderStore interface {
	ByID(ctx context.Context, id string) (Order, error)
	Save(ctx context.Context, o Order) error
}

type Service struct {
	store OrderStore
	now   func() time.Time // relógio injetável, em vez de time.Now() solto
}

func NewService(store OrderStore, now func() time.Time) *Service {
	return &Service{store: store, now: now}
}
```

- Interface de 1 a 3 métodos; nome pelo papel (`OrderStore`, `Clock`) ou sufixo `-er` quando tem um método (`Publisher`).
- Não crie a interface "para o caso de precisar": crie quando houver um segundo implementador ou um fake de teste.
- Composição das dependências (`NewService(...)`) acontece no `main`, sem container de DI nem reflection.

## Armadilha do nil em interface

Uma interface só é `nil` se o tipo **e** o valor forem `nil`. Devolver um ponteiro `nil` tipado dentro de `error` gera um erro que não é `nil`:

```go
func run() error {
	var err *ValidationError // nil, mas tem tipo
	return err               // erro != nil: bug clássico
}
```

Retorne `nil` literal quando não houver erro e nunca atribua ponteiro tipado `nil` a uma variável de interface.

## Receivers

| Use ponteiro (`*T`) quando | Use valor (`T`) quando |
| --- | --- |
| o método altera o receiver | o tipo é pequeno e imutável (como `time.Time`) |
| a struct é grande ou tem `sync.Mutex` (nunca copie) | o tipo é mapa, func ou slice usado como valor |
| outros métodos do tipo já usam ponteiro | todos os métodos são de leitura |

Seja **consistente por tipo**: não misture os dois. Um `T` só satisfaz a interface com os métodos de valor; um `*T` satisfaz com os dois conjuntos.

## Embedding

Embedding promove os métodos do tipo interno: serve para composição, não para "herança".

```go
type Logger interface{ Info(msg string, args ...any) }

type Service struct {
	Logger // promove Info; Service passa a satisfazer Logger
	store  OrderStore
}
```

Prefira um campo nomeado (`log Logger`) quando não quiser expor os métodos na API do tipo. Dois embeddings com o mesmo método geram ambiguidade e erro de compilação ao chamar. Embedding de interface em struct é útil em teste (um fake que implementa só o método usado), com `panic` implícito nos demais.

## Generics

Use quando a lógica é a mesma para vários tipos (coleção, utilitário). Antes de escrever um, veja se `slices`, `maps`, `cmp` e as builtins `min` e `max` da stdlib já resolvem (`slices.SortFunc`, `slices.Contains`, `slices.Collect(maps.Keys(m))`).

```go
func Map[T, U any](in []T, f func(T) U) []U {
	out := make([]U, 0, len(in))
	for _, v := range in {
		out = append(out, f(v))
	}
	return out
}

func Filter[T any](in []T, keep func(T) bool) []T {
	out := make([]T, 0, len(in))
	for _, v := range in {
		if keep(v) {
			out = append(out, v)
		}
	}
	return out
}
```

**Não use** generics para um único tipo concreto, quando uma interface com método já expressa o contrato, nem para esconder um `any`. Constraints úteis: `any`, `comparable`, `cmp.Ordered` e uniões como `~int | ~int64`.

## Enums e opcionais

```go
type Status string

const (
	StatusPending Status = "pending"
	StatusDone    Status = "done"
)

// ParseStatus valida a entrada externa; o tipo sozinho não impede "foo".
func ParseStatus(s string) (Status, error) {
	switch st := Status(s); st {
	case StatusPending, StatusDone:
		return st, nil
	default:
		return "", fmt.Errorf("status inválido %q", s)
	}
}
```

- Para valor numérico interno, `iota` com um método `String()`. Para valor que viaja em JSON ou mensagem, prefira string (legível e estável).
- Campo opcional em JSON: ponteiro (`*string`) distingue ausente de vazio; `json:",omitzero"` (Go 1.24+) omite o valor zero do tipo, inclusive `time.Time`.
- Tag `json` em toda struct que cruza a borda; DTO de borda é separado da entidade do núcleo quando os formatos divergem.

## Opções funcionais

Para construtor com muitos parâmetros opcionais:

```go
type Option func(*Client)

func WithTimeout(d time.Duration) Option { return func(c *Client) { c.timeout = d } }

func NewClient(opts ...Option) *Client {
	c := &Client{timeout: 5 * time.Second}
	for _, opt := range opts {
		opt(c)
	}
	return c
}
```

Para até 3 ou 4 parâmetros, uma struct de configuração é mais simples.

## Type assertion e switch

Prefira `errors.As` a assertion em erro. Em `switch v := x.(type)`, trate o `default`. Use a forma com duas saídas (`v, ok := x.(T)`) fora de switch; a forma de uma saída entra em `panic`.
