// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';

import GlobalError from './global-error';

describe('GlobalError', () => {
  it('renderiza o próprio documento, com o digest e sem a mensagem do erro', () => {
    const error = Object.assign(new Error('senha do banco: hunter2'), {
      digest: 'abc123',
    });

    const html = renderToStaticMarkup(
      <GlobalError error={error} retry={() => undefined} />,
    );

    expect(html).toMatch(/^<html lang="pt-BR">.*<body>.*<\/body><\/html>$/);
    expect(html).toContain('Código do erro: abc123');
    expect(html).toContain('Tentar de novo');
    expect(html).not.toContain('hunter2');
  });
});
