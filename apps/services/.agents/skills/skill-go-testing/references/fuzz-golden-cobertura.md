# Golden files, fuzz, benchmark e cobertura em Go

Complemento do [`SKILL.md`](../SKILL.md). Use só quando ajudam; o núcleo costuma se resolver com testes de tabela.

## Golden files, fuzz e benchmark (só quando ajudam)

- **Golden:** para saída longa e estável (um JSON de resposta grande). Guarde em `testdata/<nome>.golden`, compare bytes e regrave com uma flag `-update` (`flag.Bool` no `_test.go`, `os.WriteFile` quando ligada). Revise o diff do arquivo como código. Para resposta curta, compare campos.
- **Fuzz:** para parser de entrada externa (`ParseEnvelope`, decodificador de mensagem). Sem `-fuzz`, o `go test` roda só as sementes (`f.Add`) e o `testdata/fuzz` commitado, então entra no target `test`. O fuzz em si é manual.

```go
func FuzzParseEnvelope(f *testing.F) {
	f.Add(`{"id":"1","type":"demo","version":1}`)
	f.Fuzz(func(t *testing.T, body string) {
		if _, err := ParseEnvelope(body); err != nil && !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("erro fora do contrato: %v", err)
		}
	})
}
```

```bash
go test -run '^$' -fuzz FuzzParseEnvelope -fuzztime 10s ./internal/core
go test -run '^$' -bench . -benchmem ./internal/core     # benchmark com for b.Loop() (Go 1.24+)
```

Commite o arquivo que o fuzz gera em `testdata/fuzz/<Fuzz>/` quando achar uma falha: vira teste de regressão. Benchmark só com um número a defender; use `b.Loop()` no laço.

## Cobertura

O target já imprime `coverage: X% of statements` por pacote. O repositório **não impõe limite** em Go. Para ver linhas descobertas, e contar também o que o teste do `cmd/` exercita no núcleo:

```bash
cd apps/services/example-go
go test -coverpkg=./... -coverprofile=cov.out ./...
go tool cover -func=cov.out        # por função
go tool cover -html=cov.out        # navegador
```

Não commite `cov.out`. Meça comportamento coberto, não percentual.
