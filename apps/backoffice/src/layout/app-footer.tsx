'use client';

import { CFooter } from '@coreui/react';

import { appConfig } from '@/core/config/app-config';

export function AppFooter() {
  return (
    // WHY: o CFooter renderiza uma div sem landmark; o role dá ao rodapé a semântica de <footer> para leitores de tela.
    <CFooter className="px-4 d-print-none" role="contentinfo">
      <div>
        {appConfig.appName}{' '}
        <span className="text-body-secondary small">
          · ambiente {appConfig.appStage}
        </span>
      </div>
      <div className="ms-auto">
        Feito por{' '}
        <a
          href={appConfig.credit.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {appConfig.credit.name}
        </a>
      </div>
    </CFooter>
  );
}
