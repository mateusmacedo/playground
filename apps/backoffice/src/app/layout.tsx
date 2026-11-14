import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import 'simplebar-react/dist/simplebar.min.css';
import '../scss/styles.scss';

import { appConfig } from '@/core/config/app-config';
import { themeBootstrapScript } from '@/layout/color-mode';

import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: { default: appConfig.appName, template: `%s · ${appConfig.appName}` },
  description: `Painel ${appConfig.appName}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    // WHY: o script do tema muda `data-coreui-theme` antes da hidratação; o aviso de divergência é esperado aqui.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
