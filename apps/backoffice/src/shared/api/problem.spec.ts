import { parseProblem } from './problem';

describe('parseProblem', () => {
  it('lê o problema completo', () => {
    const body = {
      type: 'https://api.exemplo.test/problemas/revisao-desatualizada',
      title: 'Revisão desatualizada',
      status: 412,
      detail: 'O quadro está na revisão 4.',
      instance: '/boards/board-1',
    };

    expect(parseProblem({ body, status: 412 })).toEqual(body);
  });

  it('usa o tipo padrão do formato e o status da resposta quando o corpo não os traz', () => {
    const problem = parseProblem({
      body: { title: 'Versão desatualizada' },
      status: 412,
    });

    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Versão desatualizada',
      status: 412,
    });
  });

  it('fica com o status do corpo quando ele é um inteiro', () => {
    const problem = parseProblem({
      body: { title: 'Indisponível', status: 503 },
      status: 500,
    });

    expect(problem?.status).toBe(503);
  });

  it('troca pelo status da resposta o status do corpo que não é inteiro', () => {
    const problem = parseProblem({
      body: { title: 'Indisponível', status: '503' },
      status: 500,
    });

    expect(problem?.status).toBe(500);
  });

  it('deixa de fora o detalhe e a instância que não são texto', () => {
    const problem = parseProblem({
      body: { title: 'Inválido', detail: 42, instance: '' },
      status: 422,
    });

    expect(problem?.detail).toBeUndefined();
    expect(problem?.instance).toBeUndefined();
  });

  it.each([
    ['um objeto sem título', {}],
    ['um título vazio', { title: '  ' }],
    ['uma lista', [{ title: 'Erro' }]],
    ['um texto', 'erro'],
    ['um corpo vazio', undefined],
  ])('não lê problema de %s', (_caso, body) => {
    expect(parseProblem({ body, status: 500 })).toBeNull();
  });
});
