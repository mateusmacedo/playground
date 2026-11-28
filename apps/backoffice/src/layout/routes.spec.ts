import { breadcrumbs } from './breadcrumbs';
import { routeTitles } from './routes';

describe('routeTitles', () => {
  it('põe as execuções dentro de Processos na trilha', () => {
    expect(breadcrumbs('/processos/execucao', routeTitles)).toEqual([
      { label: 'Início', href: '/' },
      { label: 'Processos', href: '/processos' },
      { label: 'Execuções', href: '/processos/execucao' },
    ]);
  });

  it('deixa o editor de processos como o passo Processos', () => {
    expect(breadcrumbs('/processos', routeTitles)).toEqual([
      { label: 'Início', href: '/' },
      { label: 'Processos', href: '/processos' },
    ]);
  });
});
