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
}

const appStage = process.env.NEXT_PUBLIC_STAGE as AppStage | undefined;

export const appConfig: AppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Backoffice',
  appStage: appStage || AppStage.Local,
};
