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

export const appConfig: AppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Backoffice',
  appStage: parseAppStage(process.env.NEXT_PUBLIC_STAGE),
  credit: { name: 'Mateus Macedo', url: 'https://github.com/mateusmacedo' },
};
