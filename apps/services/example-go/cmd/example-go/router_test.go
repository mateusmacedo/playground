package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	"apps/services/example-go/internal/core"
)

func TestRouterRespondeNoModoContainer(t *testing.T) {
	recorder := httptest.NewRecorder()
	newRouter().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/example-go", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status esperado 200, recebido %d", recorder.Code)
	}
	var body core.HelloResponse
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("corpo não é JSON válido: %v", err)
	}
	if body.Path != "/example-go" {
		t.Fatalf("caminho esperado /example-go, recebido %q", body.Path)
	}
}

func TestRouterRespondeAoHealthcheck(t *testing.T) {
	recorder := httptest.NewRecorder()
	newRouter().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status esperado 204, recebido %d", recorder.Code)
	}
}

func TestRouterRespondeNoModoLambda(t *testing.T) {
	event := events.APIGatewayV2HTTPRequest{
		RawPath: "/example-go",
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: http.MethodGet,
				Path:   "/example-go",
			},
		},
	}

	response, err := httpadapter.NewV2(newRouter()).ProxyWithContext(context.Background(), event)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status esperado 200, recebido %d", response.StatusCode)
	}
	var body core.HelloResponse
	if err := json.Unmarshal([]byte(response.Body), &body); err != nil {
		t.Fatalf("corpo não é JSON válido: %v", err)
	}
	if body != core.SayHello("/example-go") {
		t.Fatalf("corpo inesperado: %+v", body)
	}
}

func captureLogs(t *testing.T, level string) *bytes.Buffer {
	t.Helper()
	previous := slog.Default()
	t.Cleanup(func() { slog.SetDefault(previous) })
	var output bytes.Buffer
	slog.SetDefault(newLogger(&output, level))
	return &output
}

func TestRecoverPanicDevolve500GenericoELogaOPanic(t *testing.T) {
	output := captureLogs(t, "info")

	handler := recoverPanic(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("detalhe interno do panic")
	}))
	request := httptest.NewRequest(http.MethodGet, "/quebra", nil)
	request = request.WithContext(withRequestID(request.Context(), "req-1"))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status esperado 500, recebido %d", recorder.Code)
	}
	if strings.Contains(recorder.Body.String(), "detalhe interno") {
		t.Fatalf("a resposta vazou o detalhe do panic: %s", recorder.Body.String())
	}
	var body errorResponse
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("corpo não é JSON válido: %v", err)
	}
	if want := (errorDetail{Code: "internal", Message: "Erro interno", RequestID: "req-1"}); body.Error != want {
		t.Fatalf("corpo esperado %+v, recebido %+v", want, body.Error)
	}
	lines := logLines(t, output)
	if len(lines) != 1 || lines[0]["message"] != "handler_panic" || lines[0]["path"] != "/quebra" {
		t.Fatalf("log inesperado: %v", lines)
	}
	if lines[0]["error"] != "detalhe interno do panic" || lines[0]["requestId"] != "req-1" {
		t.Fatalf("o log deveria guardar o detalhe do panic e o requestId: %v", lines[0])
	}
}

func TestRouterResumeARequisicaoComStatusRotaEDuracao(t *testing.T) {
	output := captureLogs(t, "info")

	request := httptest.NewRequest(http.MethodGet, "/example-go", nil)
	request.Header.Set("X-Request-Id", "req-7")
	newRouter().ServeHTTP(httptest.NewRecorder(), request)
	newRouter().ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/health", nil))
	newRouter().ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/nao-existe", nil))

	lines := logLines(t, output)
	if len(lines) != 2 {
		t.Fatalf("esperava 2 resumos (o /health vai para DEBUG): %v", lines)
	}
	first := lines[0]
	if first["message"] != "request_completed" || first["method"] != "GET" ||
		first["route"] != "GET /example-go" || first["status"] != float64(200) ||
		first["requestId"] != "req-7" {
		t.Fatalf("resumo inesperado: %v", first)
	}
	if _, ok := first["durationMs"]; !ok {
		t.Fatalf("o resumo deveria ter durationMs: %v", first)
	}
	if lines[1]["route"] != "unmatched" || lines[1]["status"] != float64(404) {
		t.Fatalf("resumo do 404 inesperado: %v", lines[1])
	}
}

func TestRouterResumeAPartirDoPanicComStatus500(t *testing.T) {
	output := captureLogs(t, "info")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /quebra", func(http.ResponseWriter, *http.Request) { panic("falha") })
	assignRequestID(logRequest(recoverPanic(mux))).ServeHTTP(
		httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/quebra", nil))

	lines := logLines(t, output)
	if len(lines) != 2 || lines[1]["message"] != "request_completed" || lines[1]["status"] != float64(500) {
		t.Fatalf("o resumo deveria sair com status 500 depois do panic: %v", lines)
	}
	if id, _ := lines[0]["requestId"].(string); id == "" || id != lines[1]["requestId"] {
		t.Fatalf("as duas linhas deveriam levar o mesmo requestId: %v", lines)
	}
}

func TestRecoverPanicNaoEngoleErrAbortHandler(t *testing.T) {
	handler := recoverPanic(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if recovered := recover(); recovered != http.ErrAbortHandler {
			t.Fatalf("esperava o panic http.ErrAbortHandler, recebido %v", recovered)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}

func TestStatusRecorderDeixaOResponseControllerAlcancarOWriterOriginal(t *testing.T) {
	original := httptest.NewRecorder()
	recorder := &statusRecorder{ResponseWriter: original, status: http.StatusOK}

	if err := http.NewResponseController(recorder).Flush(); err != nil {
		t.Fatalf("o Flush deveria chegar ao ResponseWriter original: %v", err)
	}
	if !original.Flushed {
		t.Fatal("o ResponseWriter original deveria ter recebido o Flush")
	}
}
