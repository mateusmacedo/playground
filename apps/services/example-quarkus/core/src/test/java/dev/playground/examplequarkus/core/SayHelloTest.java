package dev.playground.examplequarkus.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class SayHelloTest {

  private final SayHello sayHello = new SayHello();

  @Test
  void greetsWithTheRequestedPath() {
    HelloResponse response = sayHello.execute("/example-quarkus");

    assertEquals(
        new HelloResponse("Olá de example-quarkus", "/example-quarkus"),
        response);
  }

  @Test
  void rejectsMissingPath() {
    assertThrows(NullPointerException.class, () -> sayHello.execute(null));
  }
}
