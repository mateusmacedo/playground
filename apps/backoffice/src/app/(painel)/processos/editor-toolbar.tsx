import {
  cilActionRedo,
  cilActionUndo,
  cilCheckCircle,
  cilClone,
  cilFullscreen,
  cilTrash,
  cilWarning,
  cilXCircle,
} from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { CButton, CButtonGroup } from '@coreui/react';

import type { IssueCount } from './model/issues';
import { ArrangeGroup, type ArrangeGroupProps } from './toolbar-arrange';

export interface EditorToolbarProps extends ArrangeGroupProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasSelection: boolean;
  readonly issueCount: IssueCount;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onFitView: () => void;
  readonly onClear: () => void;
}

interface ToolbarAction {
  readonly label: string;
  readonly icon: string[];
  readonly onClick: () => void;
  readonly disabled: boolean;
  /** Atalho no formato do `aria-keyshortcuts`. */
  readonly shortcut?: string;
}

function issueSummary(count: number): string {
  if (count === 0) {
    return 'Sem problemas';
  }
  return count === 1 ? '1 problema' : `${count} problemas`;
}

/** "2 erros e 1 aviso", "1 erro", "3 avisos": só as severidades que existem. */
function issueDetail({ errors, warnings }: IssueCount): string {
  const parts: string[] = [];
  if (errors > 0) {
    parts.push(errors === 1 ? '1 erro' : `${errors} erros`);
  }
  if (warnings > 0) {
    parts.push(warnings === 1 ? '1 aviso' : `${warnings} avisos`);
  }
  return parts.join(' e ');
}

interface ActionGroupProps {
  readonly label: string;
  readonly actions: readonly ToolbarAction[];
}

function ActionGroup({ label, actions }: Readonly<ActionGroupProps>) {
  return (
    <CButtonGroup role="group" aria-label={label} size="sm">
      {actions.map((action) => (
        <CButton
          key={action.label}
          color="secondary"
          variant="outline"
          disabled={action.disabled}
          onClick={action.onClick}
          aria-keyshortcuts={action.shortcut}
        >
          <CIcon icon={action.icon} aria-hidden="true" className="me-1" />
          {action.label}
        </CButton>
      ))}
    </CButtonGroup>
  );
}

function historyActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Readonly<EditorToolbarProps>): ToolbarAction[] {
  return [
    {
      label: 'Desfazer',
      icon: cilActionUndo,
      onClick: onUndo,
      disabled: !canUndo,
      shortcut: 'Control+Z Meta+Z',
    },
    {
      label: 'Refazer',
      icon: cilActionRedo,
      onClick: onRedo,
      disabled: !canRedo,
      shortcut: 'Control+Shift+Z Control+Y Meta+Shift+Z',
    },
  ];
}

function selectionActions({
  hasSelection,
  selectedNodes,
  onDuplicate,
  onDelete,
}: Readonly<EditorToolbarProps>): ToolbarAction[] {
  return [
    {
      label: 'Duplicar',
      icon: cilClone,
      onClick: onDuplicate,
      // NOTE: a duplicação copia blocos; conexões sozinhas não têm o que duplicar. Excluir vale para as duas.
      disabled: selectedNodes === 0,
      shortcut: 'Control+D Meta+D',
    },
    {
      label: 'Excluir',
      icon: cilTrash,
      onClick: onDelete,
      disabled: !hasSelection,
      shortcut: 'Delete Backspace',
    },
  ];
}

function canvasActions({
  isEmpty,
  onFitView,
  onClear,
}: Readonly<EditorToolbarProps>): ToolbarAction[] {
  return [
    {
      label: 'Ajustar à tela',
      icon: cilFullscreen,
      onClick: onFitView,
      disabled: isEmpty,
    },
    {
      label: 'Limpar',
      icon: cilXCircle,
      onClick: onClear,
      disabled: isEmpty,
    },
  ];
}

interface IssueBadgeProps {
  readonly count: IssueCount;
}

interface BadgeLook {
  readonly color: string;
  readonly icon: string[];
}

function badgeLook({ errors, warnings }: IssueCount): BadgeLook {
  if (errors > 0) {
    return { color: 'text-bg-danger', icon: cilXCircle };
  }
  if (warnings > 0) {
    return { color: 'text-bg-warning', icon: cilWarning };
  }
  return { color: 'text-bg-success', icon: cilCheckCircle };
}

/**
 * Selo com o total de problemas. A severidade aparece na cor, no ícone e no texto: o detalhe de erros e avisos faz
 * parte do que o leitor de tela anuncia, e fica no `title` para quem passa o mouse.
 */
function IssueBadge({ count }: Readonly<IssueBadgeProps>) {
  const total = count.errors + count.warnings;
  const look = badgeLook(count);
  const detail = total === 0 ? undefined : issueDetail(count);
  return (
    <span
      role="status"
      className={`badge ms-auto d-inline-flex align-items-center gap-1 ${look.color}`}
      title={detail}
    >
      <CIcon icon={look.icon} aria-hidden="true" />
      {issueSummary(total)}
      {detail === undefined ? null : (
        <span className="visually-hidden">{`: ${detail}`}</span>
      )}
    </span>
  );
}

/** Ações gerais do editor e o resumo da validação do processo. */
export function EditorToolbar(props: Readonly<EditorToolbarProps>) {
  return (
    <div
      role="toolbar"
      aria-label="Ações do editor"
      className="d-flex flex-wrap align-items-center gap-2 mb-3"
    >
      <ActionGroup label="Histórico" actions={historyActions(props)} />
      <ActionGroup label="Seleção" actions={selectionActions(props)} />
      <ArrangeGroup {...props} />
      <ActionGroup label="Canvas" actions={canvasActions(props)} />
      <IssueBadge count={props.issueCount} />
    </div>
  );
}
