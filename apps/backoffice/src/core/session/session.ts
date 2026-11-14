export type SessionStatus = 'loading' | 'ready' | 'error' | 'expired';

export interface SessionUser {
  readonly displayName: string;
  readonly organization?: string;
}

/**
 * Contrato que o shell espera da sessão: o menu lateral filtra pelas `permissions`, o cabeçalho mostra o `user` e o
 * layout troca a página pelo estado da sessão enquanto ela não fica pronta.
 */
export interface Session {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
  /** Permissões que liberam áreas do painel, como `quotes:read`. */
  readonly permissions: ReadonlySet<string>;
  /** Texto seguro para mostrar ao usuário: nunca a mensagem crua de uma exceção, nem detalhe interno do servidor. */
  readonly error?: string;
  readonly reload: () => void;
  /** Sem `signIn`, a sessão expirada oferece só recarregar. */
  readonly signIn?: () => void;
  /** Sem `signOut`, o menu do usuário não mostra "Sair". */
  readonly signOut?: () => void;
}
