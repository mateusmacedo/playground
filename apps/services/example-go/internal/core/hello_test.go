package core

import "testing"

func TestSayHelloDevolveMensagemECaminho(t *testing.T) {
	got := SayHello("/example-go")
	want := HelloResponse{Message: "Olá de example-go", Path: "/example-go"}
	if got != want {
		t.Fatalf("esperado %+v, recebido %+v", want, got)
	}
}
