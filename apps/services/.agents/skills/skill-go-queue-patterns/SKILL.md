---
name: skill-go-queue-patterns
description: >-
  Consumo de SQS em Go nos serviços de `apps/services/*`: handler de lote na Lambda (`events.SQSEvent`, `SQSEventResponse`,
  `ReportBatchItemFailures`) e worker de long-polling no container (aws-sdk-go-v2 `sqs`), idempotência, DLQ, retentativas,
  envelope de mensagem e Floci em `http://localhost:4566`. Use ao criar ou editar serviço `service-go --type=sqs` ou
  consumidor de fila. NÃO usar para criar a fila (dono é o Terraform quando as mensagens importam) nem para filas em
  Redis (não usadas no repositório).
---

# Filas SQS em Go

O consumidor tem **dois drivers** sobre o mesmo núcleo ([ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md)): o handler de lote na Lambda e o worker de long-polling no container. Só SQS é usado no repositório; BullMQ, Redis e bibliotecas de fila sobre Redis ficam de fora.

> **Status.** O handler de lote da Lambda existe: o generator `service-go --type=sqs` gera `internal/core/messages.go`, `cmd/<svc>/lambda.go` e `server.go`. O **worker de long-polling no container é roadmap** (o `server.go` gerado só recebe uma mensagem por `POST /messages`, para teste local), e o destino em container não foi implantado.

## Dono da fila ([ADR 0004](../../../../../docs/adr/0004-serverless-e-terraform.md))

| Fila | Dono | O serviço declara |
| --- | --- | --- |
| Mensagens importam, ou 2 ou mais serviços usam | **Terraform** (L2) | só o gatilho; ARN e URL vêm do SSM (`/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`) |
| Descartável, de um único consumidor, morre com a função | **Serverless** | fila e DLQ em `resources` do `serverless.yml` (o `remove` apaga as mensagens pendentes) |

O generator tem a opção `queue` para o tipo `sqs`: `external` (fila do Terraform lida do SSM) e `owned` (fila e DLQ no próprio serviço); confira os valores e o padrão em `tools/serverless/src/generators/service-go/schema.json`. Em qualquer caso o serviço recebe a URL por variável de ambiente (`QUEUE_URL`), nunca fixa no código. No Floci, o bootstrap semeia a fila `playground-local-sample-events` com DLQ e publica `.../shared/sample-events-queue/url` e `.../arn` no SSM (`infra/local/README.md`).

## Contrato da fila padrão

A entrega é **pelo menos uma vez**: a mesma mensagem pode chegar duas vezes e fora de ordem. Por isso:

- o processamento é **idempotente** (seção abaixo);
- o `visibility timeout` da fila é **no mínimo 6 vezes o timeout da função** (mais o `MaximumBatchingWindowInSeconds`, se houver), e o `maxReceiveCount` da política de redrive é **no mínimo 5**; são as recomendações da AWS para filas consumidas por Lambda, e o template do gerador já usa `timeout * 6` e `5`;
- o corpo tem no máximo 256 KiB; payload grande vai para o S3 e a mensagem leva a referência.

## Núcleo: independente do driver

O núcleo recebe `Message{ID, Body}` e devolve erro; não conhece SQS, `events` nem HTTP. É o que o template gera:

```go
// internal/core
type Message struct {
	ID   string
	Body string
}

// ErrInvalidInput marca a entrada que o núcleo recusa e que repetir não
// resolve; quem decide o nível do log e a retentativa é o entrypoint.
var ErrInvalidInput = errors.New("invalid_input")

// ProcessMessage processa uma mensagem; corpo que não é JSON é recusado.
//
// WHY: o erro do json.Unmarshal fica de fora do retorno porque ele pode citar
// um pedaço do corpo, que pode ser segredo; o id da mensagem basta para achar
// o corpo na fila ou na DLQ.
func ProcessMessage(_ context.Context, message Message) error {
	var payload map[string]any
	if err := json.Unmarshal([]byte(message.Body), &payload); err != nil {
		return fmt.Errorf("mensagem %s com corpo inválido: %w", message.ID, ErrInvalidInput)
	}
	return nil
}
```

## Driver 1: handler de lote na Lambda

```go
func handleSQS(ctx context.Context, event events.SQSEvent) (events.SQSEventResponse, error) {
	ctx = withLambdaRequestID(ctx)
	failures := []events.SQSBatchItemFailure{}
	for _, record := range event.Records {
		message := core.Message{ID: record.MessageId, Body: record.Body}
		if err := core.ProcessMessage(ctx, message); err != nil {
			// WHY: entrada inválida é falha esperada e não se resolve repetindo; a
			// mensagem volta para a fila e segue para a DLQ pelo maxReceiveCount.
			permanent := errors.Is(err, core.ErrInvalidInput)
			level := slog.LevelError
			if permanent {
				level = slog.LevelWarn
			}
			slog.Log(ctx, level, "message_failed",
				"messageId", record.MessageId, "receiveCount", receiveCount(record),
				"permanent", permanent, "error", err)
			failures = append(failures, events.SQSBatchItemFailure{ItemIdentifier: record.MessageId})
			continue
		}
		slog.DebugContext(ctx, "message_processed", "messageId", record.MessageId)
	}
	return events.SQSEventResponse{BatchItemFailures: failures}, nil
}
```

O `lambda.go` gerado acrescenta o resumo `batch_completed` (`total`, `failed`, `durationMs`, `status`), emitido num `defer`. Só o `cmd/` loga; o núcleo devolve o erro.

- `functionResponseType: ReportBatchItemFailures` no evento `sqs` do `serverless.yml` (o gerador já declara, com `batchSize: 10`). Sem ele, qualquer erro reprocessa o lote inteiro, inclusive as mensagens boas.
- A resposta JSON é `{"batchItemFailures":[{"itemIdentifier":"<messageId>"}]}`. Lista vazia significa lote todo concluído; só os ids listados voltam à fila.
- **Retornar `error` do handler** (ou entrar em `panic`) faz a Lambda tratar o lote inteiro como falho e reentregá-lo. Reserve para falha que invalida o lote (por exemplo, não conseguiu ler a configuração); falha por mensagem vai em `batchItemFailures` e o handler devolve `nil`.
- O `ItemIdentifier` reportado é o `MessageId` do registro; monte a lista só a partir dos ids recebidos.
- Fila FIFO: o repositório não usa. A orientação da AWS é parar no primeiro erro e devolver em `batchItemFailures` a mensagem que falhou e todas as não processadas, para preservar a ordem.

## Driver 2: worker de long-polling no container (roadmap)

Padrão a seguir. O loop faz `ReceiveMessage` com long polling, processa com concorrência limitada, apaga a mensagem **só após sucesso** e encerra de forma graciosa no `SIGTERM`.

```go
type Worker struct {
	client         *sqs.Client
	queueURL       string
	handle         func(context.Context, core.Message) error
	slots          int           // mensagens em processamento ao mesmo tempo
	processTimeout time.Duration // limite por mensagem, também o prazo de drenagem
}

// Run encerra quando ctx é cancelado (SIGTERM) e as mensagens em voo terminam.
func (w *Worker) Run(ctx context.Context) {
	var inflight sync.WaitGroup
	defer inflight.Wait()
	sem := make(chan struct{}, w.slots)
	// O trabalho em voo não herda o cancelamento do SIGTERM: termina dentro de processTimeout.
	workCtx := context.WithoutCancel(ctx)

	for ctx.Err() == nil {
		out, err := w.client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
			QueueUrl:            aws.String(w.queueURL),
			MaxNumberOfMessages: 10, // máximo do SQS
			WaitTimeSeconds:     20, // máximo do SQS: long polling
		})
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.ErrorContext(ctx, "receive_failed", "error", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}
		for _, m := range out.Messages {
			sem <- struct{}{}
			inflight.Add(1)
			go func() {
				defer func() { <-sem; inflight.Done() }()
				msgCtx, cancel := context.WithTimeout(workCtx, w.processTimeout)
				defer cancel()
				w.process(msgCtx, m)
			}()
		}
	}
}

func (w *Worker) process(ctx context.Context, m types.Message) {
	msg := core.Message{ID: aws.ToString(m.MessageId), Body: aws.ToString(m.Body)}
	if err := w.handle(ctx, msg); err != nil {
		// Sem DeleteMessage: a mensagem volta após o visibility timeout e, ao
		// atingir o maxReceiveCount, segue para a DLQ.
		slog.ErrorContext(ctx, "message_failed", "messageId", msg.ID, "error", err)
		return
	}
	if _, err := w.client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(w.queueURL),
		ReceiptHandle: m.ReceiptHandle,
	}); err != nil {
		slog.ErrorContext(ctx, "message_delete_failed", "messageId", msg.ID, "error", err)
	}
}
```

- **Long polling:** `WaitTimeSeconds` vai de 0 a 20; use 20 para poucas chamadas vazias. O cancelamento do `ctx` interrompe a chamada em andamento, então o `SIGTERM` não espera os 20 s. Não coloque um timeout de contexto menor que o `WaitTimeSeconds` em volta do `ReceiveMessage`.
- **Shutdown:** `main` cria o `ctx` com `signal.NotifyContext` (`SIGTERM` e `os.Interrupt`), como o `serve` do `example-go`, e chama `Run`. O período de graça do orquestrador precisa ser maior que `processTimeout`, senão o processo recebe `SIGKILL` com mensagens em voo (elas voltam à fila, pela garantia de pelo menos uma vez).
- **Visibility timeout:** maior que o `processTimeout`. Para tarefa longa, estenda com `ChangeMessageVisibility` (o teto é 12 horas) em vez de aumentar o padrão da fila.
- **Backoff por mensagem:** peça `MessageSystemAttributeNames: [ApproximateReceiveCount]` no `ReceiveMessage` e, na falha, chame `ChangeMessageVisibility` com um prazo crescente (`min(2^n * base, teto)`). Na Lambda, o intervalo entre tentativas é o visibility timeout da fila.
- Apague em lote (`DeleteMessageBatch`, até 10 por chamada) só se a chamada individual virar gargalo; `DeleteMessageBatch` reporta falhas por item na resposta, e não no erro.
- O cliente vem do `config.LoadDefaultConfig(ctx)`, que lê `AWS_ENDPOINT_URL`; veja skill-go-db-patterns, seção "Cliente e Floci".

## Envelope e mensagem inválida

Defina o formato no núcleo, com um identificador de negócio que serve de **chave de idempotência** e um `type` e `version` para evoluir o contrato:

```go
type Envelope struct {
	ID         string          `json:"id"`
	Type       string          `json:"type"`
	Version    int             `json:"version"`
	OccurredAt time.Time       `json:"occurredAt"`
	Data       json.RawMessage `json:"data"`
}

// ParseEnvelope devolve ErrInvalidInput, a falha permanente do núcleo: reentregar
// não vai resolver.
//
// WHY: o erro do json.Unmarshal fica de fora do retorno porque ele pode citar um
// pedaço do corpo, que pode ser segredo.
func ParseEnvelope(body string) (Envelope, error) {
	var e Envelope
	if err := json.Unmarshal([]byte(body), &e); err != nil {
		return Envelope{}, fmt.Errorf("envelope com corpo inválido: %w", ErrInvalidInput)
	}
	if e.ID == "" || e.Type == "" {
		return Envelope{}, fmt.Errorf("envelope sem id ou type: %w", ErrInvalidInput)
	}
	return e, nil
}
```

- **Falha permanente** (JSON inválido, `type` ou `version` desconhecidos): reporte como falha e deixe a mensagem seguir para a DLQ após o `maxReceiveCount`, onde ela pode ser inspecionada. Não a descarte em silêncio e não a processe "pela metade".
- **Falha transitória** (dependência fora do ar, timeout): devolva o erro e deixe a fila retentar.
- Consumidor **tolerante a campo novo** (ignora o que não conhece) e produtor que só adiciona campo: assim as duas pontas evoluem em ordem qualquer.

## Idempotência

Como a mesma mensagem pode chegar mais de uma vez, o **efeito** precisa ser seguro de repetir. Em ordem de preferência:

1. Efeito naturalmente idempotente: `upsert` por chave, escrita condicional (`attribute_not_exists` no DynamoDB, veja skill-go-db-patterns).
2. Efeito e marca "já tratada" gravados **na mesma transação**.
3. Marca separada, gravada **depois** do efeito. Se a gravação da marca falhar, o efeito se repete, e isso é aceitável quando ele é seguro de repetir.

Gravar a marca **antes** do efeito perde a mensagem se o efeito falhar: a retentativa enxerga "já tratada" e conclui sem fazer nada. Efeito externo sem idempotência própria (e-mail, cobrança) deve levar a chave da mensagem ao serviço de destino, quando ele aceitar.

## Testes e execução local

- **Handler da Lambda:** teste unitário com `events.SQSEvent` montado à mão e verificação de `BatchItemFailures` (o `adapters_test.go` do gerador faz isso). Veja skill-go-testing.
- **Núcleo:** tabela de entradas, inclusive mensagem inválida e duplicada, sem SQS.
- **Worker contra o Floci:** atrás de build tag (`integration`), com `AWS_ENDPOINT_URL=http://localhost:4566` e credenciais fictícias.

```bash
export AWS_ENDPOINT_URL=http://localhost:4566 AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
aws sqs send-message \
  --queue-url http://localhost:4566/000000000000/playground-local-sample-events \
  --message-body '{"id":"1","type":"demo","version":1,"occurredAt":"2026-01-01T00:00:00Z","data":{}}'
```

## Armadilhas

| Armadilha | Prefira |
| --- | --- |
| Apagar a mensagem antes de processar | Apagar só após sucesso |
| Declarar no serviço a fila que outros serviços usam ou cujas mensagens importam | Fila do Terraform; a Lambda declara só o gatilho |
| Visibility timeout menor que o processamento | No mínimo 6 vezes o timeout da função (Lambda) ou maior que `processTimeout` (worker) |
| `maxReceiveCount` 1 sem DLQ | `maxReceiveCount` 5 ou mais, com DLQ e alarme de profundidade |
| Retornar `error` por uma mensagem ruim na Lambda | `batchItemFailures` só com o id dela |
| Retentar infinitamente mensagem inválida | Falha permanente segue para a DLQ |
| Payload grande no corpo | Objeto no S3 e referência na mensagem |
| Worker que cancela o trabalho em voo no `SIGTERM` | Parar de receber, drenar dentro de `processTimeout` |

## Checklist

- [ ] Dono da fila decidido pela regra do ADR 0004; URL e ARN por SSM e variável de ambiente.
- [ ] Núcleo sem SQS nem `events`; os dois drivers só convertem e delegam.
- [ ] `ReportBatchItemFailures` ativo e handler devolvendo só os ids que falharam.
- [ ] Visibility timeout, `maxReceiveCount` e DLQ conforme as recomendações acima.
- [ ] Idempotência definida; envelope com `id`, `type` e `version`; falha permanente vai para a DLQ.
- [ ] Worker (quando existir): long polling de 20 s, `DeleteMessage` após sucesso, drenagem no `SIGTERM`.

Veja também: skill-go, skill-go-testing, [`docs/adr/0004-serverless-e-terraform.md`](../../../../../docs/adr/0004-serverless-e-terraform.md), [`docs/adr/0008-adapters-de-runtime.md`](../../../../../docs/adr/0008-adapters-de-runtime.md) e [`infra/local/README.md`](../../../../../infra/local/README.md).
