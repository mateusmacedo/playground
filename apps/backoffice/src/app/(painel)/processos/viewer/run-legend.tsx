import { RunMarkBadge } from './run-mark-badge';
import { type RunMark, TAKEN_TEXT } from './run-marks';

interface MarkMeaning {
  readonly mark: RunMark;
  readonly meaning: string;
}

const MARK_MEANINGS: readonly MarkMeaning[] = [
  { mark: 'active', meaning: 'onde a execução está agora' },
  { mark: 'waiting', meaning: 'aguarda os outros caminhos chegarem' },
  { mark: 'done', meaning: 'a execução já passou por ela' },
  { mark: 'raised', meaning: 'o desvio por exceção aconteceu' },
];

/** Legenda do diagrama da execução: o que cada selo e o traço reforçado querem dizer. */
export function RunLegend() {
  return (
    <ul aria-label="Legenda do diagrama" className="process-run-legend">
      {MARK_MEANINGS.map(({ mark, meaning }) => (
        <li key={mark} className="process-run-legend__item">
          <RunMarkBadge mark={mark} />
          <span>{meaning}</span>
        </li>
      ))}
      <li className="process-run-legend__item">
        <span className="process-run-legend__taken" aria-hidden="true" />
        <strong>{TAKEN_TEXT}</strong>
        <span>conexão por onde a execução já passou</span>
      </li>
      <li className="process-run-legend__item">
        <strong>Sem selo</strong>
        <span>a execução ainda não chegou ao bloco</span>
      </li>
    </ul>
  );
}
