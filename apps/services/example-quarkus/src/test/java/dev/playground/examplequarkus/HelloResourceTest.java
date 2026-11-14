package dev.playground.examplequarkus;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class HelloResourceTest {

  @Test
  void greetsOnTheServicePath() {
    given().when()
        .get("/example-quarkus")
        .then()
        .statusCode(200)
        .body("message", is("Olá de example-quarkus"))
        .body("path", is("/example-quarkus"));
  }

  @Test
  void reportsHealth() {
    given().when()
        .get("/health")
        .then()
        .statusCode(200)
        .body("status", is("UP"));
  }
}
