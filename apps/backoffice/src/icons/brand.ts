import { appConfig } from '@/core/config/app-config';

// WHY: marca neutra até a identidade visual ser definida; troque os dois desenhos mantendo o formato do CoreUI
// ([viewBox, conteúdo SVG]). O `signet` aparece com o menu recolhido.
const MARK = `<rect x="3" y="3" width="26" height="26" rx="7"/><path style="fill: var(--cui-sidebar-bg, #212631)" d="M10 10h5v5h-5zm7 0h5v5h-5zm-7 7h5v5h-5zm7 0h5v5h-5z"/>`;

export const signet = ['32 32', `<g style="fill: currentColor">${MARK}</g>`];

export const logo = [
  '200 32',
  `<g style="fill: currentColor">${MARK}<text x="38" y="21.5" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="15" font-weight="600">${appConfig.appName}</text></g>`,
];
