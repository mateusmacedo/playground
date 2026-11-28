import { nameKey, suggestedName } from './names';

describe('nameKey', () => {
  it('ignora espaços nas pontas e a diferença de maiúsculas', () => {
    expect(nameKey('  Valor Aprovado ')).toBe('valor aprovado');
    expect(nameKey('   ')).toBe('');
  });
});

describe('suggestedName', () => {
  it('começa na quantidade de itens mais um', () => {
    expect(suggestedName({ prefix: 'Campo', taken: [] })).toBe('Campo 1');
    expect(suggestedName({ prefix: 'Campo', taken: ['Valor', 'Data'] })).toBe(
      'Campo 3',
    );
  });

  it('avança até o primeiro número que nenhum item usa', () => {
    const taken = ['Campo 3', 'campo 4 ', 'Motivo'];

    expect(suggestedName({ prefix: 'Campo', taken })).toBe('Campo 5');
  });
});
