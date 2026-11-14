import { breadcrumbs, type RouteTitles } from './breadcrumbs';

const titles: RouteTitles = {
  '/': 'Início',
  '/cotacoes': 'Cotações',
  '/cotacoes/nova': 'Nova cotação',
  '/cotacoes/:id': 'Detalhe',
  '/cotacoes/:id/editar': 'Editar',
};

describe('breadcrumbs', () => {
  it('começa pela raiz', () => {
    expect(breadcrumbs('/', titles)).toEqual([{ label: 'Início', href: '/' }]);
  });

  it('monta um passo por prefixo com título', () => {
    expect(breadcrumbs('/cotacoes/42/editar', titles)).toEqual([
      { label: 'Início', href: '/' },
      { label: 'Cotações', href: '/cotacoes' },
      { label: 'Detalhe', href: '/cotacoes/42' },
      { label: 'Editar', href: '/cotacoes/42/editar' },
    ]);
  });

  it('prefere a rota fixa à rota com parâmetro', () => {
    expect(breadcrumbs('/cotacoes/nova', titles).at(-1)).toEqual({
      label: 'Nova cotação',
      href: '/cotacoes/nova',
    });
  });

  it('pula prefixos sem título', () => {
    expect(
      breadcrumbs('/relatorios/mensal', {
        '/': 'Início',
        '/relatorios/mensal': 'Mensal',
      }),
    ).toEqual([
      { label: 'Início', href: '/' },
      { label: 'Mensal', href: '/relatorios/mensal' },
    ]);
  });

  it('junta títulos iguais seguidos', () => {
    expect(
      breadcrumbs('/painel', { '/': 'Painel', '/painel': 'Painel' }),
    ).toEqual([{ label: 'Painel', href: '/' }]);
  });
});
