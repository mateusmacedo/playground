---
name: skill-go-db-patterns
description: >-
  Acesso a dados em Go nos serviços de `apps/services/*`: repositório como porta em `internal/core`, adapter fora do núcleo
  (DynamoDB via aws-sdk-go-v2 e SQL via `database/sql`), erros, transações, context com timeout, pool em Lambda versus
  container e Floci com `AWS_ENDPOINT_URL`. Use quando um serviço Go precisar ler ou gravar em DynamoDB ou RDS, ler nome
  de tabela ou endereço de banco do SSM, ou escrever o adapter de um repositório. NÃO usar para criar tabela, banco ou
  migração (dono é o Terraform) nem para filas (skill-go-queue-patterns).
---

# Acesso a dados em Go

> **Status: roadmap, ainda não existe no repo.** Nenhum serviço tem banco hoje, e o Terraform (`infra/terraform`) não existe. Esta skill descreve o padrão a seguir quando o primeiro serviço precisar de dados.

## Quem é dono do quê ([ADR 0004](../../../../../docs/adr/0004-serverless-e-terraform.md))

Dado que sobrevive ao código é do **Terraform**, na camada L2 ([ADR 0009](../../../../../docs/adr/0009-camadas-e-ordem-de-implantacao.md)): tabela DynamoDB, instância RDS, bucket. O serviço **consome**:

| O serviço faz | O serviço não faz |
| --- | --- |
| Lê nome da tabela e endereço do banco do **SSM** e passa ao processo por variável de ambiente | Declarar tabela, banco ou índice no `serverless.yml` (`resources`) |
| Declara no `serverless.yml` a **role de menor privilégio** da própria Lambda, com os ARNs lidos do SSM | Ler o state do Terraform (`${terraform:outputs}` foi rejeitado) |
| Implementa o acesso por um adapter | Criar ou alterar schema na subida do processo |

```yaml
# padrão a seguir; o parâmetro vem do Terraform (L2), no caminho canônico
provider:
  environment:
    TABLE_NAME: ${ssm:/playground/${sls:stage}/${aws:region}/orders/table/name}
  iam:
    role:
      statements:
        - Effect: Allow
          Action: [dynamodb:GetItem, dynamodb:PutItem]
          Resource: ${ssm:/playground/${sls:stage}/${aws:region}/orders/table/arn}
```

O caminho é `/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`; o bootstrap do Floci já publica nome e ARN de bucket e fila nesse formato (`infra/local/README.md`). **Credencial de banco não vai no SSM `String`**: o parâmetro guarda o ARN do segredo e o serviço lê o valor no Secrets Manager. O Floci não aplica IAM, então uma permissão que falta só aparece na AWS: revise as policies à mão.

Localmente, enquanto o Terraform não existe, o bootstrap cria só tabelas mínimas (`FLOCI_SEED_TABLES`, chave `pk` string); veja [`docs/onboarding/local-aws-floci.md`](../../../../../docs/onboarding/local-aws-floci.md).

## Repositório: porta no núcleo, adapter fora

A interface mora em `internal/core`, com só o que o caso de uso chama; o núcleo não importa SDK nem `database/sql`. O adapter fica em pacote próprio (sugestão: `internal/adapters/<nome>`) e a composição acontece no `main`.

```go
// internal/core
type OrderStore interface {
	ByID(ctx context.Context, id string) (Order, error)
	Create(ctx context.Context, o Order) error
}
var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)
```

### Adapter DynamoDB (aws-sdk-go-v2)

O item persistido é uma struct **do adapter**, distinta da entidade do núcleo (o formato de armazenamento muda sem tocar o domínio).

```go
package dynamostore

type orderItem struct {
	PK   string `dynamodbav:"pk"`
	Name string `dynamodbav:"name"`
}

type Store struct {
	client *dynamodb.Client
	table  string
}

func New(client *dynamodb.Client, table string) *Store {
	return &Store{client: client, table: table}
}

func (s *Store) Create(ctx context.Context, o core.Order) error {
	item, err := attributevalue.MarshalMap(orderItem{PK: o.ID, Name: o.Name})
	if err != nil {
		return fmt.Errorf("marshal order %s: %w", o.ID, err)
	}
	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(s.table),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(pk)"),
	})
	var exists *types.ConditionalCheckFailedException
	if errors.As(err, &exists) {
		return fmt.Errorf("order %s: %w", o.ID, core.ErrConflict)
	}
	if err != nil {
		return fmt.Errorf("put order %s: %w", o.ID, err)
	}
	return nil
}

func (s *Store) ByID(ctx context.Context, id string) (core.Order, error) {
	out, err := s.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(s.table),
		Key:       map[string]types.AttributeValue{"pk": &types.AttributeValueMemberS{Value: id}},
	})
	if err != nil {
		return core.Order{}, fmt.Errorf("get order %s: %w", id, err)
	}
	if out.Item == nil {
		return core.Order{}, fmt.Errorf("order %s: %w", id, core.ErrNotFound)
	}
	var item orderItem
	if err := attributevalue.UnmarshalMap(out.Item, &item); err != nil {
		return core.Order{}, fmt.Errorf("unmarshal order %s: %w", id, err)
	}
	return core.Order{ID: item.PK, Name: item.Name}, nil
}
```

Pontos que o SDK impõe: `GetItem` de chave ausente **não** é erro, devolve `Item == nil`; escrita condicional que falha devolve `*types.ConditionalCheckFailedException`; `TransactWriteItems` (atomicidade entre itens) falha com `*types.TransactionCanceledException`, cujos `CancellationReasons` dizem qual item falhou. Em `Query`, pagine com `LastEvaluatedKey` e nunca use `Scan` em caminho de requisição. Pacotes: `aws`, `service/dynamodb`, `service/dynamodb/types` e `feature/dynamodb/attributevalue`, todos sob `github.com/aws/aws-sdk-go-v2`.

### Cliente e Floci

Crie o cliente **uma vez**, no `main`, e injete. `config.LoadDefaultConfig` lê `AWS_ENDPOINT_URL`, então o mesmo código aponta ao Floci sem ramo condicional:

```go
cfg, err := config.LoadDefaultConfig(ctx)
if err != nil {
	slog.Error("aws_config_failed", "error", err)
	os.Exit(1)
}
store := dynamostore.New(dynamodb.NewFromConfig(cfg), os.Getenv("TABLE_NAME"))
```

| Onde roda | Como chega ao Floci |
| --- | --- |
| `go run` ou teste no host | `AWS_ENDPOINT_URL=http://localhost:4566`, `AWS_REGION=us-east-1`, `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test` |
| Lambda implantada no Floci | o Floci injeta o endpoint; não defina no `serverless.yml` |
| AWS real | nada: a variável não existe e o SDK usa o endpoint regional |

Nunca fixe endpoint no código. Valide `TABLE_NAME` no boot e falhe cedo se vier vazio.

## SQL (RDS), quando existir

O mesmo desenho vale: porta no núcleo, adapter com `database/sql` (ou um gerador de código a partir de SQL, como `sqlc`), linha do banco distinta da entidade. O repositório ainda não escolheu engine nem biblioteca: registre a decisão em ADR antes. Regras independentes de escolha:

- Sempre as variantes com contexto (`QueryContext`, `ExecContext`, `BeginTx`) e parâmetros do driver (`$1` ou `?`), nunca concatenação de string.
- `defer rows.Close()` logo após checar o erro da query; verifique `rows.Err()` depois do laço.
- `sql.ErrNoRows` vira `core.ErrNotFound` no adapter; violação de unicidade vira `core.ErrConflict`.
- Colunas explícitas no `SELECT`; paginação por chave (`WHERE id > $1 ORDER BY id LIMIT $2`), não por `OFFSET` grande.
- **Transação:** `BeginTx(ctx, nil)`, `defer tx.Rollback()` (após `Commit` devolve `sql.ErrTxDone`, esperado) e `Commit()` no fim. Quando um caso de uso precisa de vários repositórios na mesma transação, a porta é um `UnitOfWork` com `Do(ctx, func(tx Stores) error) error`, implementado no adapter.

## Context e timeout

Todo acesso recebe `ctx` e um limite próprio, derivado do `ctx` da requisição (na Lambda, ele carrega o deadline da invocação):

```go
ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
defer cancel()
```

O timeout do acesso é menor que o da função. O SDK da AWS já tem retentativa com backoff; não some outra por cima sem necessidade.

## Pool e conexões: Lambda x container

| | Lambda | Container (roadmap) |
| --- | --- | --- |
| Concorrência por processo | 1 invocação por vez no modelo padrão | várias requisições ao mesmo tempo |
| Pool SQL | `SetMaxOpenConns(1)` ou `2`; `*sql.DB` criado no `main`, reutilizado entre invocações; `SetConnMaxIdleTime` curto, porque o ambiente congela entre invocações e a conexão pode morrer | dimensione `MaxOpenConns` pelo orçamento do banco: instâncias × `MaxOpenConns` abaixo do limite de conexões |
| Risco | muitas Lambdas em paralelo esgotam as conexões do banco; considere RDS Proxy (recurso do Terraform) | idem, por réplica |
| DynamoDB | cliente HTTP reutilizado, sem pool a dimensionar | idem |

## Migrações

Schema pertence ao **dono do dado** (Terraform e o processo de dados, L2), não ao serviço. O serviço não migra no boot: na Lambda a subida roda em paralelo e a cada cold start; no container, em cada réplica. Como o deploy é blue/green ([ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md)), duas versões do código convivem: toda mudança de schema é compatível com a versão anterior (adicione coluna anulável, faça o backfill, só depois torne obrigatória; remova a coluna depois que nada mais a escreve). DynamoDB não tem migração de schema: índice e chaves são do Terraform.

## Testes

Unitário com **fake** da porta, sem SDK (veja skill-go-testing). Teste do adapter contra o Floci fica atrás de build tag (`//go:build integration`), fora do `go test -race -cover ./...` do target `test`, e roda com `go test -tags integration ./...` com o Floci no ar.

## Checklist

- [ ] Nenhum recurso de dado declarado no `serverless.yml`; nome, endereço e ARN vêm do SSM canônico; segredo no Secrets Manager.
- [ ] Porta em `internal/core`; adapter fora; entidade distinta do item ou da linha.
- [ ] Erros do adapter traduzidos para `core.ErrNotFound` e `core.ErrConflict`, embrulhados com `%w`.
- [ ] Cliente criado no `main`; `AWS_ENDPOINT_URL` para o Floci; sem endpoint fixo.
- [ ] `ctx` com timeout em todo acesso; sem `Scan` em requisição; `rows.Close()` e `tx.Rollback()` em `defer`.
- [ ] Pool dimensionado para Lambda ou container; sem migração no boot.

Veja também: skill-go, [`docs/adr/0004-serverless-e-terraform.md`](../../../../../docs/adr/0004-serverless-e-terraform.md), [`docs/guides/ordem-de-implantacao.md`](../../../../../docs/guides/ordem-de-implantacao.md) e [`infra/local/README.md`](../../../../../infra/local/README.md).
