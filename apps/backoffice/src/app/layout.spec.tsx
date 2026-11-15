// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';

import { appConfig } from '@/core/config/app-config';
import { THEME_STORAGE_KEY } from '@/layout/color-mode';

import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('renderiza o documento em pt-BR com os filhos dentro do body', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Conteúdo da página</p>
      </RootLayout>,
    );

    expect(html).toMatch(/^<html lang="pt-BR"[^>]*>/);
    expect(html).toMatch(
      /<body>[\s\S]*<p>Conteúdo da página<\/p>[\s\S]*<\/body>/,
    );
  });

  it('aplica o tema salvo antes da hidratação, com o script no head', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Conteúdo da página</p>
      </RootLayout>,
    );

    expect(html).toMatch(/<head><script>[\s\S]*<\/script><\/head>/);
    expect(html).toContain(THEME_STORAGE_KEY);
  });
});

describe('metadata', () => {
  it('usa o nome do painel no título, com o título da página antes dele', () => {
    expect(metadata.title).toEqual({
      default: appConfig.appName,
      template: `%s · ${appConfig.appName}`,
    });
  });

  it('pede aos buscadores que não indexem o painel', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
