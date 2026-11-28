import {
  ALL_ROLES,
  NO_ROLE,
  roleOptions,
  stepMatchesRole,
  stepRole,
} from './pending-steps-roles';

describe('stepRole', () => {
  it('trata o papel em branco como sem papel', () => {
    expect(stepRole({ role: ' Analista ' })).toBe('Analista');
    expect(stepRole({ role: '  ' })).toBeUndefined();
    expect(stepRole({})).toBeUndefined();
  });
});

describe('roleOptions', () => {
  it('oferece todos, cada papel em ordem alfabética e, havendo etapa sem papel, "Sem papel"', () => {
    const options = roleOptions([
      { role: 'Revisor' },
      { role: 'Analista' },
      {},
      { role: 'Revisor' },
    ]);

    expect(options).toEqual([
      { value: ALL_ROLES, label: 'Todos os papéis' },
      { value: 'role:Analista', label: 'Analista' },
      { value: 'role:Revisor', label: 'Revisor' },
      { value: NO_ROLE, label: 'Sem papel' },
    ]);
  });

  it('não oferece "Sem papel" quando toda etapa tem papel', () => {
    const values = roleOptions([{ role: 'Analista' }]).map(
      (option) => option.value,
    );

    expect(values).toEqual([ALL_ROLES, 'role:Analista']);
  });
});

describe('stepMatchesRole', () => {
  it('deixa passar toda etapa com o filtro em todos os papéis', () => {
    expect(stepMatchesRole({ step: {}, value: ALL_ROLES })).toBe(true);
    expect(
      stepMatchesRole({ step: { role: 'Analista' }, value: ALL_ROLES }),
    ).toBe(true);
  });

  it('deixa passar só a etapa sem papel com o filtro em sem papel', () => {
    expect(stepMatchesRole({ step: {}, value: NO_ROLE })).toBe(true);
    expect(
      stepMatchesRole({ step: { role: 'Analista' }, value: NO_ROLE }),
    ).toBe(false);
  });

  it('deixa passar só a etapa do papel escolhido, sem confundir o papel com os valores fixos', () => {
    const value = 'role:Analista';
    expect(stepMatchesRole({ step: { role: 'Analista' }, value })).toBe(true);
    expect(stepMatchesRole({ step: { role: 'Revisor' }, value })).toBe(false);
    expect(stepMatchesRole({ step: {}, value })).toBe(false);
    expect(stepMatchesRole({ step: { role: 'none' }, value: NO_ROLE })).toBe(
      false,
    );
  });
});
