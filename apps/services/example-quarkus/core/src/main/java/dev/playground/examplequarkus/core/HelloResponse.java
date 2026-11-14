package dev.playground.examplequarkus.core;

/** Resposta do caso de uso {@link SayHello}. */
public record HelloResponse(String message, String path) {
}
