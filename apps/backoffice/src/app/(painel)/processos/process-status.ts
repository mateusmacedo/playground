import {
  hasUnpublishedChanges,
  latestVersion,
  type ProcessDefinition,
} from '@/shared/process/catalog';

export type ProcessStatusKind = 'draft' | 'published' | 'changed';

/** Situação de um processo do catálogo, pelo que está gravado: o que ainda não foi salvo não entra. */
export interface ProcessStatus {
  readonly kind: ProcessStatusKind;
  /** Texto em PT-BR, que diz a situação sem depender da cor do selo. */
  readonly label: string;
}

export function processStatus(definition: ProcessDefinition): ProcessStatus {
  const latest = latestVersion(definition);
  if (latest === undefined) {
    return { kind: 'draft', label: 'Rascunho' };
  }
  const published = `Publicada v${latest.version}`;
  if (hasUnpublishedChanges(definition)) {
    return {
      kind: 'changed',
      label: `${published}, com alterações não publicadas`,
    };
  }
  return { kind: 'published', label: published };
}
