'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useIsClient } from '@/shared/hooks/use-is-client';
import { LoadingState } from '@/shared/ui/states';

import { RunDiagram } from './run-diagram';
import { RUNS_HREF } from './run-links';
import { RunList } from './run-list';
import { REF_PARAM } from './use-run-view';

const LIST_TITLE = 'Execuções';

/** A lista ou o diagrama, conforme o endereço de agora; acompanha a troca do endereço sem recarregar a página. */
function RunsByAddress() {
  const ref = useSearchParams().get(REF_PARAM) || null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownRef = useRef(ref);

  // WHY: na troca entre a lista e o diagrama, o link acionado sai da tela e o título da aba continua o mesmo: nem o
  // foco nem o anúncio de rota contam que a tela trocou. O foco no título conta, e a leitura segue dali.
  useEffect(() => {
    if (shownRef.current === ref) {
      return;
    }
    shownRef.current = ref;
    headingRef.current?.focus();
  }, [ref]);

  if (ref === null) {
    return (
      <>
        <h1 ref={headingRef} tabIndex={-1} className="h4 mb-2">
          {LIST_TITLE}
        </h1>
        <RunList />
      </>
    );
  }
  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h1 ref={headingRef} tabIndex={-1} className="h4 mb-0">
          Execução do processo
        </h1>
        <Link href={RUNS_HREF}>Todas as execuções</Link>
      </div>
      {/* WHY: o diagrama lê o endereço ao montar; a chave o monta de novo quando o endereço passa a pedir outra
          execução. */}
      <RunDiagram key={ref} />
    </>
  );
}

/**
 * Página das execuções. Sem a referência no endereço (`?ref=`), que é como o menu a abre, mostra a lista das execuções
 * em andamento; com ela, o diagrama daquela execução e o link de volta para a lista.
 */
export function RunsView() {
  const isClient = useIsClient();

  // WHY: o servidor não conhece o endereço completo, e ler o endereço na renderização dele tiraria a rota do build
  // estático. Por isso a primeira renderização é só o carregamento, e o endereço é lido no navegador.
  if (!isClient) {
    return (
      <>
        <h1 className="h4 mb-2">{LIST_TITLE}</h1>
        <LoadingState label="Carregando…" rows={3} />
      </>
    );
  }
  return <RunsByAddress />;
}
