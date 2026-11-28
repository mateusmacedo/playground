import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Caminho de um arquivo do projeto do contrato da API (`apps/backoffice-mock`), para os testes que conferem o painel
 * contra ele: os dados iniciais do mock e a amostra que o contrato valida.
 */
export function contractProjectFile(path: string): string {
  return resolve(HERE, '../../../../../../backoffice-mock', path);
}
