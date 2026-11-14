import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sem acesso' };

/** Destino de quem entrou sem nenhuma permissão do painel. */
export default function NoAccessPage() {
  return (
    <div className="card mb-4">
      <div className="card-body text-center py-5">
        <h1 className="h4">Seu usuário ainda não tem acesso</h1>
        <p className="text-body-secondary mb-0">
          Nenhuma área do painel está liberada para você. Peça o acesso a quem
          administra os usuários.
        </p>
      </div>
    </div>
  );
}
