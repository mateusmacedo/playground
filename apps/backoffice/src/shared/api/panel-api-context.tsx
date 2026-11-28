'use client';

import { createContext, type ReactNode, useContext } from 'react';

import { CONFIGURED_PANEL_API, type PanelApi } from './panel-api';

// NOTE: o valor padrão é a API configurada, então o painel não precisa montar o provider para as telas a acharem.
const PanelApiContext = createContext<PanelApi | null>(CONFIGURED_PANEL_API);

export interface PanelApiProviderProps {
  /** A API que as telas de dentro passam a usar; `null` as deixa guardando no navegador. */
  readonly value: PanelApi | null;
  readonly children: ReactNode;
}

/** Troca a API das telas de dentro, no lugar da configurada. É por aqui que um teste entrega a API simulada. */
export function PanelApiProvider({
  value,
  children,
}: Readonly<PanelApiProviderProps>) {
  return <PanelApiContext value={value}>{children}</PanelApiContext>;
}

/**
 * A API do painel, ou `null` quando ele guarda tudo no navegador. É o ponto único em que uma tela descobre se a API
 * está ligada: com `null`, ela segue pelo adaptador do `localStorage`.
 */
export function usePanelApi(): PanelApi | null {
  return useContext(PanelApiContext);
}
