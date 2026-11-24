import {
  CCloseButton,
  COffcanvas,
  COffcanvasBody,
  COffcanvasHeader,
} from '@coreui/react';
import { useEffect, useId, useRef } from 'react';
import type { Board, CardLocation } from '../model/board';
import type { BoardCommands } from '../use-board';
import { CardDetails, type CardDetailsActions } from './card-details';

export interface CardDetailsPanelProps {
  readonly visible: boolean;
  /** Card aberto; some quando o card é excluído. */
  readonly location: CardLocation | undefined;
  readonly board: Board;
  readonly commands: BoardCommands;
  readonly actions: CardDetailsActions;
  /** Nome de quem comenta. */
  readonly author: string;
  readonly onClose: () => void;
}

/**
 * Painel lateral com os detalhes do card. Não tem fundo escuro nem prende o foco: o quadro continua utilizável, e
 * clicar em outro card troca o conteúdo. O painel recebe o foco ao abrir e a cada troca de card.
 */
export function CardDetailsPanel({
  visible,
  location,
  board,
  commands,
  actions,
  author,
  onClose,
}: Readonly<CardDetailsPanelProps>) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const shownCardId = useRef<string | undefined>(undefined);
  const cardId = visible ? location?.card.id : undefined;

  useEffect(() => {
    // NOTE: na troca de card com o painel aberto, o conteúdo remonta e o foco que estava nele se perderia.
    if (cardId && shownCardId.current && shownCardId.current !== cardId) {
      panelRef.current?.focus();
    }
    shownCardId.current = cardId;
  }, [cardId]);

  return (
    <COffcanvas
      ref={panelRef}
      // WHY: o painel entra com transição e só aceita o foco depois de ficar visível, no quadro seguinte ao início.
      onShow={() => requestAnimationFrame(() => panelRef.current?.focus())}
      placement="end"
      backdrop={false}
      scroll
      visible={visible}
      onHide={onClose}
      aria-labelledby={titleId}
      className="kanban-details"
    >
      <COffcanvasHeader>
        <h2 id={titleId} className="offcanvas-title h5">
          Detalhes do card
        </h2>
        <CCloseButton aria-label="Fechar os detalhes" onClick={onClose} />
      </COffcanvasHeader>
      <COffcanvasBody>
        {location ? (
          <CardDetails
            key={location.card.id}
            location={location}
            board={board}
            commands={commands}
            actions={actions}
            author={author}
          />
        ) : null}
      </COffcanvasBody>
    </COffcanvas>
  );
}
