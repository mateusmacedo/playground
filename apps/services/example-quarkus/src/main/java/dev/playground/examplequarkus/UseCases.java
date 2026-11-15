package dev.playground.examplequarkus;

import dev.playground.examplequarkus.core.SayHello;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

/** Liga os casos de uso do núcleo, que não conhece CDI, ao container. */
@ApplicationScoped
public class UseCases {

  // WHY: @Singleton, e não @ApplicationScoped, porque o SayHello do núcleo é
  // final e não pode ganhar o client proxy que um escopo normal exige; o núcleo
  // continua sem nenhuma anotação de CDI.
  @Produces
  @Singleton
  SayHello sayHello() {
    return new SayHello();
  }
}
