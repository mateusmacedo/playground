import { countIssues } from './issues';

describe('countIssues', () => {
  it('separa erros de avisos', () => {
    expect(
      countIssues([
        { key: 'a', severity: 'error', message: 'A' },
        { key: 'b', severity: 'warning', message: 'B' },
        { key: 'c', severity: 'warning', message: 'C' },
      ]),
    ).toEqual({ errors: 1, warnings: 2 });
  });
});
