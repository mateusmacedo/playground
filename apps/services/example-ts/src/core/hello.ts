export type HelloRequest = {
  path: string;
};

export type HelloResponse = {
  message: string;
  path: string;
};

export const sayHello = (request: HelloRequest): HelloResponse => ({
  message: 'Olá de example-ts',
  path: request.path,
});
