/** Registro, no histórico do card, de uma dependência ou de um item de checklist que virou card filho. */
export type LinkActivity =
  | {
      readonly at: string;
      readonly kind: 'blocker-added';
      /** Título do card que passou a bloquear este. */
      readonly blocker: string;
    }
  | {
      readonly at: string;
      readonly kind: 'blocker-removed';
      /** Título do card que deixou de bloquear este. */
      readonly blocker: string;
    }
  | {
      readonly at: string;
      readonly kind: 'checklist-converted';
      /** Texto do item, que virou o título do card filho. */
      readonly item: string;
    }
  | {
      readonly at: string;
      readonly kind: 'from-checklist';
      readonly lane: string;
      /** Título do card pai, de cujo checklist o item saiu. */
      readonly parent: string;
    };
