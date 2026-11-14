import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Início' };

export default function HomePage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Início</h1>
        <p className="text-body-secondary mb-0">
          Página inicial do painel. Páginas novas entram em{' '}
          <code>src/app/(painel)</code>, com o item do menu em{' '}
          <code>src/layout/nav.ts</code> e o título do breadcrumb em{' '}
          <code>src/layout/routes.ts</code>.
        </p>
      </div>
    </div>
  );
}
