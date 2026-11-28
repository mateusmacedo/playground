/**
 * Configuração pública do painel, lida das variáveis `NEXT_PUBLIC_*` no build. Só entra aqui o que pode ir para o
 * navegador: segredos ficam no servidor.
 */

export enum AppStage {
  Local = 'local',
  Dev = 'dev',
  Homolog = 'homolog',
  Prod = 'prod',
}

export interface AppConfig {
  readonly appName: string;
  readonly appStage: AppStage;
  /** Endereço base da API do painel, sem barra no fim; `null` quando o painel guarda tudo no navegador. */
  readonly apiBaseUrl: string | null;
  /** Crédito do rodapé: quem mantém o painel e o endereço dele. */
  readonly credit: { readonly name: string; readonly url: string };
}

function isAppStage(value: string): value is AppStage {
  return (Object.values(AppStage) as string[]).includes(value);
}

/**
 * Sem valor, o ambiente é `local`. Um valor fora da lista falha na hora: um erro de digitação em `NEXT_PUBLIC_STAGE`
 * deixaria o painel dizendo um ambiente que não é o dele, sem ninguém notar.
 */
export function parseAppStage(value: string | undefined): AppStage {
  if (!value) {
    return AppStage.Local;
  }
  if (!isAppStage(value)) {
    throw new Error(
      `NEXT_PUBLIC_STAGE inválido: "${value}". Use um destes: ${Object.values(AppStage).join(', ')}.`,
    );
  }
  return value;
}

const API_PROTOCOLS = ['http:', 'https:'];

function toUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    // WHY: o `URL` lança para texto que não é endereço; aqui isso é só mais um valor inválido da variável.
    return null;
  }
}

function isPlainApiAddress(url: URL): boolean {
  if (!API_PROTOCOLS.includes(url.protocol)) {
    return false;
  }
  const hasCredentials = url.username !== '' || url.password !== '';
  const hasExtras = url.search !== '' || url.hash !== '';
  return !hasCredentials && !hasExtras;
}

/**
 * Sem valor, não há API e o painel guarda tudo no navegador. Um valor que não é endereço `http` ou `https` simples
 * falha na hora, pelo mesmo motivo do `NEXT_PUBLIC_STAGE`. As barras do fim saem, para o caminho de cada chamada
 * começar sempre com `/`.
 */
export function parseApiBaseUrl(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) {
    return null;
  }
  const url = toUrl(text);
  if (url === null || !isPlainApiAddress(url)) {
    // WHY: a mensagem não repete o valor: um endereço colado com usuário e senha iria parar no log do build.
    throw new Error(
      'NEXT_PUBLIC_API_URL inválido. Use um endereço http ou https sem usuário, senha, query nem fragmento, como http://127.0.0.1:4010.',
    );
  }
  let address = `${url.origin}${url.pathname}`;
  while (address.endsWith('/')) {
    address = address.slice(0, -1);
  }
  return address;
}

export const appConfig: AppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Backoffice',
  appStage: parseAppStage(process.env.NEXT_PUBLIC_STAGE),
  apiBaseUrl: parseApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
  credit: { name: 'Mateus Macedo', url: 'https://github.com/mateusmacedo' },
};
