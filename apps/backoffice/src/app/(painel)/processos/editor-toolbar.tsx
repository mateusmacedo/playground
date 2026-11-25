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

export interface EditorToolbarProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasSelection: boolean;
  readonly isEmpty: boolean;
  readonly issueCount: number;
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
  readonly count: number;
}

function IssueBadge({ count }: Readonly<IssueBadgeProps>) {
  let color = 'text-bg-warning';
  if (count === 0) {
    color = 'text-bg-success';
  }
  return (
    <span role="status" className={`badge ms-auto ${color}`}>
      {issueSummary(count)}
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
      <ActionGroup label="Canvas" actions={canvasActions(props)} />
      <IssueBadge count={props.issueCount} />
    </div>
  );
}
