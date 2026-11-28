import type { PendingStep } from './model/pending-steps';

/** Valor do filtro que mostra as etapas de todos os papéis. */
export const ALL_ROLES = 'all';
/** Valor do filtro que mostra só as etapas sem papel. */
export const NO_ROLE = 'none';

const ROLE_PREFIX = 'role:';

export interface RoleOption {
  readonly value: string;
  readonly label: string;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/** Papel da etapa; o papel em branco conta como sem papel. */
export function stepRole(step: Pick<PendingStep, 'role'>): string | undefined {
  return step.role?.trim() || undefined;
}

/**
 * Opções do filtro por papel: todos, cada papel que aparece nas etapas, em ordem alfabética, e "Sem papel" quando
 * alguma etapa não tem papel.
 */
export function roleOptions(
  steps: readonly Pick<PendingStep, 'role'>[],
): readonly RoleOption[] {
  const roles = new Set<string>();
  let withoutRole = false;
  for (const step of steps) {
    const role = stepRole(step);
    if (role === undefined) {
      withoutRole = true;
    } else {
      roles.add(role);
    }
  }
  const options: RoleOption[] = [
    { value: ALL_ROLES, label: 'Todos os papéis' },
  ];
  for (const role of [...roles].sort(collator.compare)) {
    // NOTE: o prefixo separa o papel escrito no processo dos dois valores fixos do filtro.
    options.push({ value: `${ROLE_PREFIX}${role}`, label: role });
  }
  if (withoutRole) {
    options.push({ value: NO_ROLE, label: 'Sem papel' });
  }
  return options;
}

export interface MatchesRoleParams {
  readonly step: Pick<PendingStep, 'role'>;
  /** Valor escolhido no filtro, um dos que `roleOptions` oferece. */
  readonly value: string;
}

/** Diz se a etapa passa no filtro por papel. */
export function stepMatchesRole(params: MatchesRoleParams): boolean {
  const { step, value } = params;
  if (value === ALL_ROLES) {
    return true;
  }
  const role = stepRole(step);
  if (value === NO_ROLE) {
    return role === undefined;
  }
  return role !== undefined && value === `${ROLE_PREFIX}${role}`;
}
