import { useId } from 'react';

import { CheckField } from '@/shared/ui/check-field';
import type { BoardRules } from '../model/board';
import { BOARD_RULES, type BoardRule } from '../model/rules';

interface RuleText {
  readonly label: string;
  /** O que a regra faz, em uma frase. */
  readonly help: string;
}

const RULE_TEXT: Readonly<Record<BoardRule, RuleText>> = {
  parentWaitsChildren: {
    label: 'Card pai espera os filhos',
    help: 'O card pai só entra na coluna de conclusão depois de todos os filhos.',
  },
  parentFollowsChildren: {
    label: 'Card pai acompanha os filhos',
    help: 'Quando o último filho chega à coluna de conclusão, o card pai vai junto.',
  },
  doneWaitsProcess: {
    label: 'Conclusão espera o processo',
    help: 'O card com processo em andamento não entra na coluna de conclusão.',
  },
  processEndMovesCard: {
    label: 'Processo concluído conclui o card',
    help: 'Quando o processo termina, o card vai para a coluna de conclusão.',
  },
  doneWaitsBlockers: {
    label: 'Conclusão espera as dependências',
    help: 'O card bloqueado por outro ainda não concluído não entra na coluna de conclusão.',
  },
  childInherits: {
    label: 'Card filho herda do pai',
    help: 'O card filho novo recebe o responsável e as etiquetas do card pai.',
  },
};

/** A única regra que não depende da coluna de conclusão. */
const WITHOUT_DONE_LANE: BoardRule = 'childInherits';

const NEEDS_DONE_LANE =
  'Depende da coluna de conclusão: escolha uma acima para usar esta regra.';

export interface BoardRulesFieldProps {
  readonly rules: BoardRules;
  /** O quadro tem coluna de conclusão escolhida na janela. */
  readonly hasDoneLane: boolean;
  readonly onChange: (rules: BoardRules) => void;
}

/**
 * Regras opcionais do quadro, todas desligadas até alguém ligar. As que dependem da coluna de conclusão ficam
 * travadas, com o motivo, enquanto o quadro não tem uma; a regra continua como estava, para voltar a valer quando a
 * coluna for escolhida.
 */
export function BoardRulesField({
  rules,
  hasDoneLane,
  onChange,
}: Readonly<BoardRulesFieldProps>) {
  const legendId = useId();
  const baseId = useId();

  return (
    <fieldset aria-labelledby={legendId}>
      <legend id={legendId} className="fs-6 fw-semibold">
        Regras do quadro
      </legend>
      <div className="d-grid gap-2">
        {BOARD_RULES.map((rule) => {
          const text = RULE_TEXT[rule];
          const locked = !hasDoneLane && rule !== WITHOUT_DONE_LANE;
          const helpId = `${baseId}-${rule}-help`;
          return (
            <div key={rule}>
              <CheckField
                id={`${baseId}-${rule}`}
                label={text.label}
                describedBy={helpId}
                checked={rules[rule] === true}
                disabled={locked}
                onChange={(checked) => onChange({ ...rules, [rule]: checked })}
              />
              <div id={helpId} className="form-text mt-0">
                {text.help}
                {locked ? ` ${NEEDS_DONE_LANE}` : null}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
