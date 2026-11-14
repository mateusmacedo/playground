package dev.playground.examplequarkus;

import dev.playground.examplequarkus.core.SayHello;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

/** Liga os casos de uso do núcleo, que não conhece CDI, ao container. */
@Singleton
public class UseCases {

  @Produces
  @Singleton
  SayHello sayHello() {
    return new SayHello();
  }
}
