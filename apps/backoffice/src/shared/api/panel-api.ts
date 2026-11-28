import { appConfig } from '@/core/config/app-config';

import { type BoardsApi, createBoardsApi } from './boards-api';
import { createHttpClient } from './http-client';
import {
  createProcessDefinitionsApi,
  type ProcessDefinitionsApi,
} from './process-definitions-api';

/** Tudo o que o painel chama na API dele. */
export interface PanelApi {
  readonly boards: BoardsApi;
  readonly processDefinitions: ProcessDefinitionsApi;
}

export interface PanelApiConfig {
  /** Endereço base da API, sem barra no fim; `null` quando não há API. */
  readonly baseUrl: string | null;
  /** Tempo limite de cada chamada, em milissegundos. */
  readonly timeoutMs?: number;
  /** O `fetch` a usar no lugar do global. */
  readonly fetch?: typeof fetch;
}

/** A API do painel no endereço dado; `null` sem endereço, quando o painel guarda tudo no navegador. */
export function createPanelApi(config: PanelApiConfig): PanelApi | null {
  const { baseUrl, timeoutMs, fetch } = config;
  if (baseUrl === null) {
    return null;
  }
  const client = createHttpClient({ baseUrl, timeoutMs, fetch });
  return {
    boards: createBoardsApi(client),
    processDefinitions: createProcessDefinitionsApi(client),
  };
}

/** A API no endereço de `NEXT_PUBLIC_API_URL`, a mesma para o painel inteiro; `null` sem a variável. */
export const CONFIGURED_PANEL_API: PanelApi | null = createPanelApi({
  baseUrl: appConfig.apiBaseUrl,
});
