import { AppStage, appConfig, parseAppStage } from './app-config';

describe('parseAppStage', () => {
  it('sem valor, o ambiente é local', () => {
    expect(parseAppStage(undefined)).toBe(AppStage.Local);
    expect(parseAppStage('')).toBe(AppStage.Local);
  });

  it.each(Object.values(AppStage))('aceita o ambiente %s', (stage) => {
    expect(parseAppStage(stage)).toBe(stage);
  });

  it('falha cedo, com a lista dos valores aceitos, num valor desconhecido', () => {
    expect(() => parseAppStage('producao')).toThrow(
      'NEXT_PUBLIC_STAGE inválido: "producao". Use um destes: local, dev, homolog, prod.',
    );
  });

  it('não aceita variação de caixa', () => {
    expect(() => parseAppStage('Prod')).toThrow('NEXT_PUBLIC_STAGE inválido');
  });
});

describe('appConfig', () => {
  it('traz o crédito do rodapé com nome e endereço https', () => {
    expect(appConfig.credit.name).not.toBe('');
    expect(appConfig.credit.url).toMatch(/^https:\/\//);
  });
});
