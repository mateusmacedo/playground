package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/aws/aws-lambda-go/lambdacontext"
)

const defaultPort = "8080"

// setupLogger troca o logger padrão do slog, que escreve texto, por JSON no
// stdout (contrato de serviço do ADR 0008), com o nível vindo de LOG_LEVEL.
func setupLogger() {
	slog.SetDefault(newLogger(os.Stdout, os.Getenv("LOG_LEVEL")))
}

// newLogger aceita debug, info, warn ou error (sem diferenciar maiúsculas);
// valor vazio ou desconhecido vale info.
func newLogger(w io.Writer, levelName string) *slog.Logger {
	level := slog.LevelInfo
	invalid := levelName != "" && level.UnmarshalText([]byte(levelName)) != nil
	if invalid {
		level = slog.LevelInfo
	}

	handler := slog.NewJSONHandler(w, &slog.HandlerOptions{Level: level, ReplaceAttr: formatAttr})
	logger := slog.New(requestIDHandler{handler})
	if invalid {
		logger.Warn("invalid_log_level", "logLevel", levelName)
	}
	return logger
}

// WHY: lista de permissão, e não de bloqueio: um campo novo nasce redigido e só
// aparece no log depois que alguém decide que é seguro. O valor de uma chave
// permitida segue sendo de quem loga, então nunca anexe corpo de requisição,
// token nem dado de cartão.
var safeKeys = map[string]bool{
	// formato mínimo comum a TypeScript, Go e Quarkus
	"requestId": true,
	// unidade de trabalho: mensagem, lote, requisição e execução agendada
	"messageId":    true,
	"receiveCount": true,
	"scheduledAt":  true,
	"method":       true,
	"path":         true,
	"route":        true,
	"status":       true,
	"total":        true,
	"failed":       true,
	"durationMs":   true,
	"permanent":    true,
	// partida do servidor e configuração
	"addr":     true,
	"logLevel": true,
	// erro
	"error": true,
	"stack": true,
}

const redacted = "[redacted]"

// formatAttr dá ao log o formato mínimo comum (`time`, `level` em minúsculas,
// `message`, `requestId`) e redige o campo fora da lista de permissão.
func formatAttr(groups []string, attr slog.Attr) slog.Attr {
	if len(groups) == 0 {
		switch attr.Key {
		case slog.TimeKey:
			return attr
		case slog.MessageKey:
			return slog.Attr{Key: "message", Value: attr.Value}
		case slog.LevelKey:
			if level, ok := attr.Value.Any().(slog.Level); ok {
				return slog.String("level", strings.ToLower(level.String()))
			}
		}
	}
	if !safeKeys[attr.Key] {
		return slog.String(attr.Key, redacted)
	}
	return attr
}

type requestIDKey struct{}

func withRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// requestIDHandler acrescenta o requestId do context a cada registro.
//
// WHY: o id vem do logger, e não do call site: toda linha da mesma invocação o
// leva sem que quem escreve o log precise lembrar dele. Vale para quem usa as
// variantes com contexto (`slog.InfoContext`).
type requestIDHandler struct{ slog.Handler }

func (h requestIDHandler) Handle(ctx context.Context, record slog.Record) error {
	if id := requestIDFrom(ctx); id != "" {
		record.AddAttrs(slog.String("requestId", id))
	}
	return h.Handler.Handle(ctx, record)
}

func (h requestIDHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return requestIDHandler{h.Handler.WithAttrs(attrs)}
}

func (h requestIDHandler) WithGroup(name string) slog.Handler {
	return requestIDHandler{h.Handler.WithGroup(name)}
}

// withLambdaRequestID põe no contexto o id da invocação da Lambda; fora da
// Lambda devolve o contexto como veio.
func withLambdaRequestID(ctx context.Context) context.Context {
	if invocation, ok := lambdacontext.FromContext(ctx); ok {
		return withRequestID(ctx, invocation.AwsRequestID)
	}
	return ctx
}

const (
	requestIDHeader    = "X-Request-Id"
	maxRequestIDLength = 64
)

// assignRequestID dá um requestId a cada requisição: o da invocação da Lambda
// (o adaptador herda o contexto dela), senão o cabeçalho X-Request-Id, senão um
// id gerado.
//
// WHY: o cabeçalho vem do cliente; o tamanho é limitado para ele não inflar
// cada linha de log da requisição.
func assignRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(withRequestID(r.Context(), requestIDFor(r))))
	})
}

func requestIDFor(r *http.Request) string {
	if invocation, ok := lambdacontext.FromContext(r.Context()); ok && invocation.AwsRequestID != "" {
		return invocation.AwsRequestID
	}
	if id := r.Header.Get(requestIDHeader); id != "" && len(id) <= maxRequestIDLength {
		return id
	}
	return rand.Text()
}

// routeOf devolve o padrão da rota que atendeu a requisição, como "GET /health",
// ou "unmatched" quando nenhuma casou.
func routeOf(r *http.Request) string {
	if r.Pattern == "" {
		return "unmatched"
	}
	return r.Pattern
}

// runningOnLambda indica se o processo foi iniciado pelo runtime da Lambda,
// que sempre define AWS_LAMBDA_RUNTIME_API.
func runningOnLambda() bool {
	_, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
	return ok
}

func listenAddress() string {
	if port := os.Getenv("PORT"); port != "" {
		return ":" + port
	}
	return ":" + defaultPort
}

// WHY: o ALB fecha conexão ociosa em 60 s (padrão do módulo alb); o servidor
// precisa fechar depois dele, senão o ALB reaproveita uma conexão já fechada e
// devolve 502. Leitura e escrita têm prazo para um cliente lento não prender
// a conexão para sempre; WriteTimeout acompanha o limite de 30 s do HTTP API.
const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 15 * time.Second
	writeTimeout      = 30 * time.Second
	idleTimeout       = 75 * time.Second
	shutdownTimeout   = 10 * time.Second
)

func newServer(handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              listenAddress(),
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
}

// serve atende o modo container (ECS, EKS ou EC2) com o mesmo núcleo usado
// na Lambda e encerra de forma limpa no SIGTERM do orquestrador.
func serve(handler http.Handler) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	server := newServer(handler)
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		slog.Error("server_failed", "error", err)
		os.Exit(1)
	}

	slog.Info("server_started", "addr", listener.Addr().String())
	if err := runServer(ctx, server, listener, shutdownTimeout); err != nil {
		slog.Error("server_failed", "error", err)
		os.Exit(1)
	}
	slog.Info("server_stopped")
}

// runServer atende até o servidor falhar ou o ctx ser cancelado. No
// cancelamento, espera as requisições em andamento terminarem, até o prazo.
//
// WHY: Shutdown faz Serve devolver ErrServerClosed assim que ele começa, não
// quando termina; sem esperar o done, o processo sairia e cortaria a
// requisição em andamento.
func runServer(ctx context.Context, server *http.Server, listener net.Listener, timeout time.Duration) error {
	done := make(chan struct{})
	go func() {
		defer close(done)
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("server_shutdown_failed", "error", err)
		}
	}()

	err := server.Serve(listener)
	if errors.Is(err, http.ErrServerClosed) {
		<-done
		return nil
	}
	return err
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// WHY: o cabeçalho de status já foi enviado; o erro de escrita costuma
		// ser o cliente que desistiu, e não falha do serviço.
		slog.WarnContext(r.Context(), "response_write_failed", "route", routeOf(r), "error", err)
	}
}

type errorResponse struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"requestId"`
}

// writeError escreve o corpo de erro HTTP do serviço, o mesmo em todos os
// tipos: um `code` estável, uma mensagem segura para exibir e o requestId que
// liga a resposta ao log.
//
// WHY: o detalhe do erro fica no log; a mensagem recebida aqui vai ao cliente,
// então nunca passe `err.Error()` nela.
func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	writeJSON(w, r, status, errorResponse{Error: errorDetail{
		Code:      code,
		Message:   message,
		RequestID: requestIDFrom(r.Context()),
	}})
}
