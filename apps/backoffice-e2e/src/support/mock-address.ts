const DEFAULT_PORT = '4010';
// NOTE: token local e fictício, o padrão do compose do mock; não é segredo.
const DEFAULT_ADMIN_TOKEN = 'local-mock-token';

export interface MockAddress {
  /** Sem barra no fim: é o valor que o painel recebe em `NEXT_PUBLIC_API_URL`. */
  readonly apiUrl: string;
  readonly adminToken: string;
}

function readMockAddress(): MockAddress {
  const port = process.env.BACKOFFICE_MOCK_PORT || DEFAULT_PORT;
  const adminToken =
    process.env.BACKOFFICE_MOCK_ADMIN_TOKEN || DEFAULT_ADMIN_TOKEN;
  return { apiUrl: `http://127.0.0.1:${port}`, adminToken };
}

// WHY: as variáveis e os padrões são os do compose de `apps/backoffice-mock`; quem muda a porta ou o token lá exporta
// os mesmos valores para o e2e.
export const MOCK_ADDRESS: MockAddress = readMockAddress();
