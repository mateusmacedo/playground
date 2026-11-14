/** Um passo do breadcrumb: o título da rota e o endereço dela. */
export interface Crumb {
  readonly label: string;
  readonly href: string;
}

/**
 * Título de cada rota do painel. Segmentos que começam com `:` aceitam qualquer valor, como `/cotacoes/:id`; quando
 * uma rota fixa e uma com parâmetro casam, vale a fixa.
 */
export type RouteTitles = Readonly<Record<string, string>>;

/**
 * Trilha da rota ativa: um passo por prefixo do endereço que tem título, da raiz à folha. Dois títulos iguais
 * seguidos viram um só.
 */
export function breadcrumbs(pathname: string, titles: RouteTitles): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const routes = Object.entries(titles).map(([route, label]) => ({
    parts: route.split('/').filter(Boolean),
    label,
  }));
  const crumbs: Crumb[] = [];
  for (let depth = 0; depth <= segments.length; depth++) {
    const prefix = segments.slice(0, depth);
    const label = bestMatch(routes, prefix);
    if (label && crumbs.at(-1)?.label !== label) {
      crumbs.push({ label, href: `/${prefix.join('/')}` });
    }
  }
  return crumbs;
}

function bestMatch(
  routes: readonly { parts: readonly string[]; label: string }[],
  segments: readonly string[],
): string | undefined {
  const matches = routes.filter(
    ({ parts }) =>
      parts.length === segments.length &&
      parts.every(
        (part, index) => part.startsWith(':') || part === segments[index],
      ),
  );
  matches.sort((a, b) => paramCount(a.parts) - paramCount(b.parts));
  return matches[0]?.label;
}

function paramCount(parts: readonly string[]): number {
  return parts.filter((part) => part.startsWith(':')).length;
}
