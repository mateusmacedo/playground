import { CFormTextarea } from '@coreui/react';
import { useId } from 'react';

import type { BoardCommands } from '../board-commands';
import type { Announce } from '../board-notices';
import type { Board, CardLocation } from '../model/board';
import { cardKey } from '../model/card-key';
import { aggregateProgress } from '../model/completion';
import { ancestorsOf } from '../model/hierarchy';
import { ActivityList } from './activity-list';
import { AssigneeField } from './assignee-field';
import { AttachmentsSection } from './attachments-section';
import { CardActionButtons } from './card-action-buttons';
import { CardHeader } from './card-header';
import { ChecklistSection } from './checklist-section';
import { ChildrenSection } from './children-section';
import { CommentsSection } from './comments-section';
import { DependenciesSection } from './dependencies-section';
import { DueField } from './due-field';
import { duplicateTreeAction } from './duplicate-tree';
import { LabelsField } from './labels-field';
import { PlacementFields } from './placement-fields';
import { ProcessSection } from './process-section';
import { TitleField } from './title-field';

/** Ações do card que passam pelo quadro (confirmação, foco, anúncio). */
export interface CardDetailsActions {
  readonly onOpenCard: (cardId: string) => void;
  readonly onRequestRemove: (cardId: string) => void;
  readonly onArchive: (cardId: string) => void;
  readonly onDuplicate: (cardId: string) => void;
  /** Sem a área de transferência no navegador, o botão de copiar o link não aparece. */
  readonly onCopyLink?: (cardId: string) => void;
  /** Diz ao leitor de tela o que uma ação do painel mudou no quadro. */
  readonly onAnnounce?: Announce;
}

export interface CardDetailsProps {
  readonly location: CardLocation;
  readonly board: Board;
  readonly commands: BoardCommands;
  /** Nome de quem comenta. */
  readonly author: string;
  readonly actions: CardDetailsActions;
}

/** Formulário do card aberto: texto, dados, coluna, hierarquia, anexos, comentários, histórico e as ações do card. */
export function CardDetails({
  location,
  board,
  commands,
  actions,
  author,
}: Readonly<CardDetailsProps>) {
  const descriptionId = useId();
  const { card } = location;
  const { lanes } = board;
  const cardId = card.id;
  const ancestors = ancestorsOf({ lanes, cardId });
  const pathFromRoot = [...ancestors].reverse();
  const progress = aggregateProgress({
    lanes,
    doneLaneId: board.config.doneLaneId,
  }).get(cardId);
  const duplicateTree = duplicateTreeAction({
    card,
    lanes,
    commands,
    onOpenCard: actions.onOpenCard,
    onAnnounce: actions.onAnnounce,
  });

  return (
    <div className="d-grid gap-3">
      <CardHeader
        card={card}
        cardKey={cardKey({ card, prefix: board.config.keyPrefix })}
        path={pathFromRoot}
        onOpenCard={actions.onOpenCard}
        onCopyLink={actions.onCopyLink}
      />
      <TitleField cardId={cardId} title={card.title} commands={commands} />
      <CFormTextarea
        id={descriptionId}
        label="Descrição"
        rows={4}
        value={card.description ?? ''}
        onChange={(event) =>
          commands.updateCard({
            cardId,
            patch: { description: event.target.value },
          })
        }
      />
      <LabelsField card={card} labels={board.labels} commands={commands} />
      <AssigneeField
        card={card}
        people={board.config.people ?? []}
        commands={commands}
      />
      <DueField card={card} commands={commands} />
      <ChecklistSection
        card={card}
        commands={commands}
        onAnnounce={actions.onAnnounce}
      />
      <ProcessSection
        location={location}
        board={board}
        commands={commands}
        author={author}
        onOpenCard={actions.onOpenCard}
        onAnnounce={actions.onAnnounce}
      />
      <PlacementFields location={location} lanes={lanes} commands={commands} />
      <ChildrenSection
        location={location}
        lanes={lanes}
        progress={progress}
        commands={commands}
        onOpenCard={actions.onOpenCard}
      />
      <DependenciesSection
        card={card}
        board={board}
        commands={commands}
        onOpenCard={actions.onOpenCard}
        onAnnounce={actions.onAnnounce}
      />
      <AttachmentsSection card={card} commands={commands} />
      <CommentsSection card={card} author={author} commands={commands} />
      <ActivityList activity={card.activity ?? []} />
      <CardActionButtons
        cardId={cardId}
        onDuplicate={actions.onDuplicate}
        onDuplicateTree={duplicateTree}
        onArchive={actions.onArchive}
        onRequestRemove={actions.onRequestRemove}
      />
    </div>
  );
}
