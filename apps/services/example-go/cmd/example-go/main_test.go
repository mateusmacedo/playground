package main

import (
	"bufio"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"os"
	"syscall"
	"testing"
	"time"
)

const awaitTimeout = 5 * time.Second

// stdoutLogs redireciona o stdout para um pipe e entrega, linha a linha, os
// logs JSON escritos nele. Ao fim do teste restaura o stdout e o logger padrão.
//
// WHY: o setupLogger, e portanto o main, fixa o stdout no logger; trocar o
// os.Stdout antes da chamada é a única forma de ler o que o processo logaria, e
// o canal também serve de sinal de que o servidor já subiu.
func stdoutLogs(t *testing.T) <-chan map[string]any {
	t.Helper()
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("não abriu o pipe: %v", err)
	}
	previousLogger := slog.Default()
	previousStdout := os.Stdout
	os.Stdout = writer

	lines := make(chan map[string]any, 64)
	go func() {
		defer close(lines)
		scanner := bufio.NewScanner(reader)
		for scanner.Scan() {
			var entry map[string]any
			if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
				t.Errorf("linha de log não é JSON: %q", scanner.Text())
				continue
			}
			lines <- entry
		}
		if err := scanner.Err(); err != nil {
			t.Errorf("erro ao ler o log do stdout: %v", err)
		}
	}()
	t.Cleanup(func() {
		os.Stdout = previousStdout
		slog.SetDefault(previousLogger)
		_ = writer.Close()
		// O canal fecha quando o scanner chega ao fim do pipe; drenar evita que a
		// goroutine fique presa num envio com o buffer cheio.
		for range lines {
		}
		_ = reader.Close()
	})
	return lines
}

// awaitMessage lê o log até a linha com o campo message pedido e a devolve.
func awaitMessage(t *testing.T, lines <-chan map[string]any, message string) map[string]any {
	t.Helper()
	timeout := time.After(awaitTimeout)
	for {
		select {
		case entry, ok := <-lines:
			if !ok {
				t.Fatalf("o log terminou antes da linha %q", message)
			}
			if entry["message"] == message {
				return entry
			}
		case <-timeout:
			t.Fatalf("a linha de log %q não apareceu dentro do prazo", message)
		}
	}
}

func awaitClosed(t *testing.T, done <-chan struct{}, what string) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(awaitTimeout):
		t.Fatalf("%s não terminou dentro do prazo", what)
	}
}

// awaitServerStart espera o log server_started e devolve a URL base, em
// loopback, do servidor que subiu na porta sorteada.
func awaitServerStart(t *testing.T, lines <-chan map[string]any) string {
	t.Helper()
	started := awaitMessage(t, lines, "server_started")
	addr, _ := started["addr"].(string)
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		t.Fatalf("addr do server_started inválido (%q): %v", addr, err)
	}
	return "http://" + net.JoinHostPort("127.0.0.1", port)
}

func statusOf(t *testing.T, url string) int {
	t.Helper()
	client := http.Client{Timeout: awaitTimeout}
	response, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	_ = response.Body.Close()
	return response.StatusCode
}

// sendSIGTERM manda o SIGTERM do orquestrador ao próprio processo de teste.
//
// WHY: sem um signal.NotifyContext ativo o SIGTERM encerra o processo de teste;
// por isso cada teste só chama isto depois do log server_started, que o serve
// emite depois de registrar o tratamento do sinal.
func sendSIGTERM(t *testing.T) {
	t.Helper()
	process, err := os.FindProcess(os.Getpid())
	if err != nil {
		t.Fatalf("não achou o próprio processo: %v", err)
	}
	if err := process.Signal(syscall.SIGTERM); err != nil {
		t.Fatalf("não enviou o SIGTERM: %v", err)
	}
}

func TestServeAtendeEEncerraDeFormaLimpaNoSIGTERM(t *testing.T) {
	t.Setenv("PORT", "0")
	t.Setenv("LOG_LEVEL", "info")
	lines := stdoutLogs(t)
	setupLogger()

	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		serve(newRouter())
	}()
	baseURL := awaitServerStart(t, lines)

	if got := statusOf(t, baseURL+"/health"); got != http.StatusNoContent {
		t.Fatalf("status esperado 204 no /health, recebido %d", got)
	}
	sendSIGTERM(t)

	awaitClosed(t, stopped, "serve")
	awaitMessage(t, lines, "server_stopped")
}

func TestMainSobeOServidorHTTPForaDaLambda(t *testing.T) {
	t.Setenv("PORT", "0")
	t.Setenv("LOG_LEVEL", "info")
	// NOTE: o t.Setenv devolve a variável ao estado original no fim do teste,
	// inclusive quando ela não existia; o Unsetenv só garante que ela não esteja
	// definida.
	t.Setenv("AWS_LAMBDA_RUNTIME_API", "")
	if err := os.Unsetenv("AWS_LAMBDA_RUNTIME_API"); err != nil {
		t.Fatalf("não removeu AWS_LAMBDA_RUNTIME_API: %v", err)
	}
	lines := stdoutLogs(t)

	finished := make(chan struct{})
	go func() {
		defer close(finished)
		main()
	}()
	baseURL := awaitServerStart(t, lines)

	if got := statusOf(t, baseURL+"/example-go"); got != http.StatusOK {
		t.Fatalf("status esperado 200 no /example-go, recebido %d", got)
	}
	sendSIGTERM(t)

	awaitClosed(t, finished, "main")
	awaitMessage(t, lines, "server_stopped")
}
