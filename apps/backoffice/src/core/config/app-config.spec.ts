import {
  AppStage,
  appConfig,
  parseApiBaseUrl,
  parseAppStage,
} from './app-config';

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

describe('parseApiBaseUrl', () => {
  it('sem valor, não há API', () => {
    expect(parseApiBaseUrl(undefined)).toBeNull();
    expect(parseApiBaseUrl('')).toBeNull();
    expect(parseApiBaseUrl('   ')).toBeNull();
  });

  it.each(['http://127.0.0.1:4010', 'https://api.exemplo.test'])(
    'aceita o endereço %s como está',
    (address) => {
      expect(parseApiBaseUrl(address)).toBe(address);
    },
  );

  it('tira as barras do fim e os espaços em volta', () => {
    expect(parseApiBaseUrl(' http://127.0.0.1:4010/ ')).toBe(
      'http://127.0.0.1:4010',
    );
    expect(parseApiBaseUrl('https://api.exemplo.test/painel//')).toBe(
      'https://api.exemplo.test/painel',
    );
  });

  it('mantém o caminho do endereço', () => {
    expect(parseApiBaseUrl('https://api.exemplo.test/painel/v1')).toBe(
      'https://api.exemplo.test/painel/v1',
    );
  });

  it.each([
    ['texto que não é endereço', 'servidor local'],
    ['protocolo que não é http nem https', 'ftp://api.exemplo.test'],
    ['usuário', 'https://ana@api.exemplo.test'],
    ['usuário e senha', 'https://ana:segredo@api.exemplo.test'],
    ['query', 'https://api.exemplo.test?chave=valor'],
    ['fragmento', 'https://api.exemplo.test#topo'],
  ])('falha cedo num endereço com %s', (_caso, address) => {
    expect(() => parseApiBaseUrl(address)).toThrow(
      'NEXT_PUBLIC_API_URL inválido. Use um endereço http ou https',
    );
  });

  it('não repete na mensagem o valor recusado', () => {
    expect(() =>
      parseApiBaseUrl('https://ana:segredo@api.exemplo.test'),
    ).not.toThrow(/segredo/);
  });
});

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('traz o crédito do rodapé com nome e endereço https', () => {
    expect(appConfig.credit.name).not.toBe('');
    expect(appConfig.credit.url).toMatch(/^https:\/\//);
  });

  it('sem NEXT_PUBLIC_API_URL, fica sem endereço de API', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.resetModules();

    const loaded = await import('./app-config');

    expect(loaded.appConfig.apiBaseUrl).toBeNull();
  });

  it('lê o endereço da API de NEXT_PUBLIC_API_URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:4010/');
    vi.resetModules();

    const loaded = await import('./app-config');

    expect(loaded.appConfig.apiBaseUrl).toBe('http://127.0.0.1:4010');
  });
});
