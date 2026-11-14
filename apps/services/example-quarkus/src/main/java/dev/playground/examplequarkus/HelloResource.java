package dev.playground.examplequarkus;

import dev.playground.examplequarkus.core.HelloResponse;
import dev.playground.examplequarkus.core.SayHello;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.UriInfo;

// WHY: o módulo core não tem índice Jandex; sem o registro explícito, o
// executável nativo serializaria o record sem os campos.
@RegisterForReflection(targets = HelloResponse.class)
@Path("/example-quarkus")
public class HelloResource {

  private final SayHello sayHello;

  HelloResource(SayHello sayHello) {
    this.sayHello = sayHello;
  }

  @GET
  @Produces(MediaType.APPLICATION_JSON)
  public HelloResponse hello(@Context UriInfo uriInfo) {
    return sayHello.execute(uriInfo.getRequestUri().getPath());
  }
}
