import { render, screen } from '@testing-library/react';

import { appConfig } from '@/core/config/app-config';

import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  it('mostra o nome do painel e o ambiente', () => {
    render(<AppFooter />);

    const footer = screen.getByRole('contentinfo');

    expect(footer.textContent).toContain(appConfig.appName);
    expect(footer.textContent).toContain(`ambiente ${appConfig.appStage}`);
  });

  it('credita quem mantém o painel, com o link abrindo em outra aba com segurança', () => {
    render(<AppFooter />);

    const link = screen.getByRole('link', { name: appConfig.credit.name });

    expect(link.getAttribute('href')).toBe(appConfig.credit.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
