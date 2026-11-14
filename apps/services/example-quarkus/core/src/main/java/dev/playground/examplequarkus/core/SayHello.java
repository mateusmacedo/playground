package dev.playground.examplequarkus.core;

import java.util.Objects;

/** Monta a saudação do serviço para o caminho recebido. */
public final class SayHello {

  static final String MESSAGE = "Olá de example-quarkus";

  public HelloResponse execute(String path) {
    return new HelloResponse(MESSAGE, Objects.requireNonNull(path, "path"));
  }
}
