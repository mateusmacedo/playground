import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { sayHello } from '../core/hello.js';
import { log, withRequestId } from './logger.js';

const respond = (
  event: APIGatewayProxyEventV2,
  requestId: string,
): APIGatewayProxyStructuredResultV2 => {
  try {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sayHello({ path: event.rawPath })),
    };
  } catch (error) {
    // WHY: o detalhe vai só para o log; a resposta leva o requestId para o
    // cliente reportar o caso sem ver stack nem mensagem interna.
    log('error', 'unhandled_error', {
      method: event.requestContext.http.method,
      route: event.routeKey,
      error,
    });
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: { code: 'internal', message: 'Erro interno', requestId },
      }),
    };
  }
};

// WHY: a linha-resumo sai depois do respond, que nunca lança, então cobre
// sucesso e falha; o requestId é o da invocação da Lambda.
export const handler = (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> =>
  withRequestId(context.awsRequestId, async () => {
    const startedAt = Date.now();
    const result = respond(event, context.awsRequestId);
    log('info', 'request_completed', {
      method: event.requestContext.http.method,
      route: event.routeKey,
      status: result.statusCode,
      durationMs: Date.now() - startedAt,
    });
    return result;
  });
