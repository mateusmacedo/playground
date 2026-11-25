import {
  cilActionRedo,
  cilActionUndo,
  cilClone,
  cilFullscreen,
  cilTrash,
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

function issueDetail({ errors, warnings }: IssueCount): string {
  const errorText = errors === 1 ? '1 erro' : `${errors} erros`;
  const warningText = warnings === 1 ? '1 aviso' : `${warnings} avisos`;
  return `${errorText} e ${warningText}`;
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
  onDuplicate,
  onDelete,
}: Readonly<EditorToolbarProps>): ToolbarAction[] {
  return [
    {
      label: 'Duplicar',
      icon: cilClone,
      onClick: onDuplicate,
      disabled: !hasSelection,
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

/** Selo com o total de problemas; a cor separa erro de aviso, e o texto completo vai no `title`. */
function IssueBadge({ count }: Readonly<IssueBadgeProps>) {
  const total = count.errors + count.warnings;
  let color = 'text-bg-success';
  if (count.errors > 0) {
    color = 'text-bg-danger';
  } else if (count.warnings > 0) {
    color = 'text-bg-warning';
  }
  return (
    <span
      role="status"
      className={`badge ms-auto ${color}`}
      title={total === 0 ? undefined : issueDetail(count)}
    >
      {issueSummary(total)}
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
