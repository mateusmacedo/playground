'use client';

import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { breadcrumbs } from './breadcrumbs';
import { routeTitles } from './routes';

export function AppBreadcrumb() {
  const crumbs = breadcrumbs(usePathname(), routeTitles);

  return (
    <CBreadcrumb className="my-0">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <CBreadcrumbItem active={last} key={crumb.href}>
            {last ? crumb.label : <Link href={crumb.href}>{crumb.label}</Link>}
          </CBreadcrumbItem>
        );
      })}
    </CBreadcrumb>
  );
}
