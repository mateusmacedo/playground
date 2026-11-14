package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/lambdacontext"
)

func TestRunningOnLambdaDependeDaVariavelDoRuntime(t *testing.T) {
	t.Setenv("AWS_LAMBDA_RUNTIME_API", "127.0.0.1:9001")
	if !runningOnLambda() {
		t.Fatal("esperava modo Lambda com AWS_LAMBDA_RUNTIME_API definida")
	}
}

func TestListenAddressUsaPortOuPadrao(t *testing.T) {
	t.Setenv("PORT", "")
	if got := listenAddress(); got != ":8080" {
		t.Fatalf("endereço padrão esperado :8080, recebido %s", got)
	}

	t.Setenv("PORT", "9090")
	if got := listenAddress(); got != ":9090" {
		t.Fatalf("endereço esperado :9090, recebido %s", got)
	}
}

func logLines(t *testing.T, output *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(output.String()), "\n") {
		if line == "" {
			continue
		}
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("linha de log não é JSON: %q", line)
		}
		lines = append(lines, entry)
	}
	return lines
}

func TestNewLoggerEscreveJSONNoFormatoMinimoComum(t *testing.T) {
	var output bytes.Buffer
	logger := newLogger(&output, "DEBUG")
	logger.Debug("debug_event", "messageId", "m1")

	lines := logLines(t, &output)
	if len(lines) != 1 || lines[0]["message"] != "debug_event" || lines[0]["level"] != "debug" || lines[0]["messageId"] != "m1" {
		t.Fatalf("log inesperado: %v", lines)
	}
	if _, ok := lines[0]["time"]; !ok {
		t.Fatalf("a linha deveria ter time: %v", lines[0])
	}
	if _, ok := lines[0]["msg"]; ok {
		t.Fatalf("o campo deveria se chamar message, e não msg: %v", lines[0])
	}
}

func TestNewLoggerUsaInfoQuandoONivelEInvalido(t *testing.T) {
	var output bytes.Buffer
	logger := newLogger(&output, "verboso")
	logger.Debug("debug_event")
	logger.Info("info_event")

	lines := logLines(t, &output)
	if len(lines) != 2 || lines[0]["message"] != "invalid_log_level" || lines[0]["logLevel"] != "verboso" || lines[1]["message"] != "info_event" {
		t.Fatalf("log inesperado: %v", lines)
	}
}

func TestNewLoggerAcrescentaORequestIDDoContexto(t *testing.T) {
	var output bytes.Buffer
	logger := newLogger(&output, "info")
	ctx := withRequestID(context.Background(), "req-1")

	logger.InfoContext(ctx, "com_contexto")
	logger.With("messageId", "m1").InfoContext(ctx, "com_atributo")
	logger.Info("sem_contexto")

	lines := logLines(t, &output)
	if len(lines) != 3 || lines[0]["requestId"] != "req-1" || lines[1]["requestId"] != "req-1" || lines[1]["messageId"] != "m1" {
		t.Fatalf("log inesperado: %v", lines)
	}
	if _, ok := lines[2]["requestId"]; ok {
		t.Fatalf("sem contexto não deveria haver requestId: %v", lines[2])
	}
}

func TestNewLoggerNaoDeixaTokenNemCartaoChegaremAoLog(t *testing.T) {
	const token = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura"
	const card = "4111111111111111"
	var output bytes.Buffer
	logger := newLogger(&output, "info")

	logger.Info("payment_received",
		"messageId", "m1",
		"authorization", token,
		"card", card,
		slog.Group("payload", slog.String("card", card), slog.Any("headers", []string{token})))

	if strings.Contains(output.String(), "eyJ") || strings.Contains(output.String(), card) {
		t.Fatalf("o log vazou token ou cartão: %s", output.String())
	}
	line := logLines(t, &output)[0]
	if line["messageId"] != "m1" || line["authorization"] != "[redacted]" || line["card"] != "[redacted]" {
		t.Fatalf("redação inesperada: %v", line)
	}
}

type failingResponseWriter struct{ header http.Header }

func (f failingResponseWriter) Header() http.Header     { return f.header }
func (failingResponseWriter) WriteHeader(int)           {}
func (failingResponseWriter) Write([]byte) (int, error) { return 0, errors.New("broken pipe") }

func TestWriteJSONLogaEmWarnComARotaQuandoOClienteCai(t *testing.T) {
	previous := slog.Default()
	t.Cleanup(func() { slog.SetDefault(previous) })
	var output bytes.Buffer
	slog.SetDefault(newLogger(&output, "info"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /dados", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, r, http.StatusOK, map[string]string{"ok": "sim"})
	})
	mux.ServeHTTP(failingResponseWriter{header: http.Header{}}, httptest.NewRequest(http.MethodGet, "/dados", nil))

	lines := logLines(t, &output)
	if len(lines) != 1 || lines[0]["level"] != "warn" || lines[0]["message"] != "response_write_failed" || lines[0]["route"] != "GET /dados" {
		t.Fatalf("log inesperado: %v", lines)
	}
}

func TestAssignRequestIDEscolheInvocacaoDepoisCabecalhoDepoisGerado(t *testing.T) {
	var got string
	handler := assignRequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = requestIDFrom(r.Context())
	}))
	serve := func(request *http.Request) string {
		got = ""
		handler.ServeHTTP(httptest.NewRecorder(), request)
		return got
	}

	withHeader := httptest.NewRequest(http.MethodGet, "/", nil)
	withHeader.Header.Set("X-Request-Id", "do-cabecalho")
	if id := serve(withHeader); id != "do-cabecalho" {
		t.Fatalf("esperava o id do cabeçalho, recebido %q", id)
	}

	tooLong := httptest.NewRequest(http.MethodGet, "/", nil)
	tooLong.Header.Set("X-Request-Id", strings.Repeat("a", maxRequestIDLength+1))
	if id := serve(tooLong); id == "" || strings.HasPrefix(id, "aaaa") {
		t.Fatalf("esperava um id gerado no lugar do cabeçalho longo, recebido %q", id)
	}

	inLambda := httptest.NewRequest(http.MethodGet, "/", nil)
	inLambda.Header.Set("X-Request-Id", "do-cabecalho")
	inLambda = inLambda.WithContext(lambdacontext.NewContext(inLambda.Context(), &lambdacontext.LambdaContext{AwsRequestID: "da-invocacao"}))
	if id := serve(inLambda); id != "da-invocacao" {
		t.Fatalf("esperava o id da invocação, recebido %q", id)
	}
}

func TestNewServerDefinePrazosDeLeituraEscritaEOciosidade(t *testing.T) {
	server := newServer(http.NotFoundHandler())

	if server.ReadHeaderTimeout <= 0 || server.ReadTimeout <= 0 || server.WriteTimeout <= 0 {
		t.Fatalf("prazos de leitura e escrita devem estar definidos: %+v", server)
	}
	// O ALB fecha a conexão ociosa em 60 s; o servidor precisa fechar depois.
	if server.IdleTimeout <= 60*time.Second {
		t.Fatalf("IdleTimeout deve passar dos 60 s do ALB, recebido %s", server.IdleTimeout)
	}
}

func startRunServer(t *testing.T, handler http.Handler, timeout time.Duration) (addr string, cancel context.CancelFunc, served <-chan error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("não abriu o listener: %v", err)
	}
	server := &http.Server{Handler: handler}
	t.Cleanup(func() { _ = server.Close() })

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	result := make(chan error, 1)
	go func() { result <- runServer(ctx, server, listener, timeout) }()
	return listener.Addr().String(), cancel, result
}

func TestRunServerEsperaARequisicaoEmAndamentoNoShutdown(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		w.WriteHeader(http.StatusNoContent)
	})
	addr, cancel, served := startRunServer(t, handler, 5*time.Second)

	status := make(chan int, 1)
	go func() {
		client := http.Client{Timeout: 5 * time.Second}
		response, err := client.Get("http://" + addr)
		if err != nil {
			status <- 0
			return
		}
		_ = response.Body.Close()
		status <- response.StatusCode
	}()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("a requisição não chegou ao handler")
	}

	cancel()
	select {
	case err := <-served:
		t.Fatalf("runServer retornou com a requisição em andamento (erro: %v)", err)
	case <-time.After(100 * time.Millisecond):
	}

	close(release)
	if got := <-status; got != http.StatusNoContent {
		t.Fatalf("a requisição em andamento deveria terminar com 204, recebido %d", got)
	}
	select {
	case err := <-served:
		if err != nil {
			t.Fatalf("shutdown limpo não deveria devolver erro: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runServer não retornou depois de drenar a requisição")
	}
}

func TestRunServerDesisteQuandoOPrazoDoShutdownEstoura(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	handler := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		close(started)
		<-release
	})
	addr, cancel, served := startRunServer(t, handler, 50*time.Millisecond)

	go func() {
		client := http.Client{Timeout: 5 * time.Second}
		if response, err := client.Get("http://" + addr); err == nil {
			_ = response.Body.Close()
		}
	}()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("a requisição não chegou ao handler")
	}

	cancel()
	select {
	case err := <-served:
		if err != nil {
			t.Fatalf("estouro do prazo é logado, não devolvido: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runServer ficou preso depois do prazo do shutdown")
	}
}

func TestRunServerDevolveErroQuandoOServidorFalha(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("não abriu o listener: %v", err)
	}
	_ = listener.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err = runServer(ctx, &http.Server{}, listener, time.Second)

	if err == nil {
		t.Fatal("esperava erro com o listener fechado")
	}
}
