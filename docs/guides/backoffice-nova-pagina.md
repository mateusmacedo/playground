# Guia: criar uma página no backoffice

Uma página nova no painel mexe em **três lugares**: a rota em `src/app/(painel)`, o item do menu em `src/layout/nav.ts` e o título do breadcrumb em `src/layout/routes.ts`. Todos os caminhos abaixo são relativos a `apps/backoffice/`.

O exemplo cria a tela "Clientes", em `/clientes`, liberada pela permissão `customers:read`.

## 1. A rota

Crie `src/app/(painel)/clientes/page.tsx`. Tudo dentro de `(painel)` já recebe o menu lateral, o cabeçalho e o rodapé. O parêntese só agrupa as rotas e **não** aparece na URL.

```tsx
import type { Metadata } from 'next';

import { CustomerList } from './customer-list';

export const metadata: Metadata = { title: 'Clientes' };

export default function CustomersPage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Clientes</h1>
        <CustomerList />
      </div>
    </div>
  );
}
```

O `title` vira "Clientes · Backoffice" na aba, pelo `template` definido em `src/app/layout.tsx`.

**Idioma**: nomes de arquivo, de componente, de tipo e de variável ficam em **inglês** (`customer-list.tsx`, `CustomerList`); a **URL da rota** e os **textos da interface** ficam em PT-BR (`/clientes`, "Excluir cliente"). O nome da pasta da rota é a própria URL, por isso `clientes`.

A `page.tsx` fica como componente de servidor, porque é ela quem exporta `metadata`. Quem usa hooks (`useToast`, `useSession`, `useState`) precisa ser componente de cliente, com `'use client'` no topo: por isso a lista vai para um arquivo separado.

## 2. O item do menu

Em `src/layout/nav.ts`, acrescente ao array `navItems`. O ícone vem de `@coreui/icons` (por exemplo `cilPeople`) e é passado direto, sem `CIcon` aqui.

```ts
import { cilHome, cilPeople } from '@coreui/icons';

export const navItems: readonly NavItem[] = [
  { kind: 'link', name: 'Início', href: '/', icon: cilHome },
  { kind: 'title', name: 'Cadastros' },
  {
    kind: 'link',
    name: 'Clientes',
    href: '/clientes',
    icon: cilPeople,
    permission: 'customers:read',
  },
];
```

Os três formatos de `NavItem`:

| `kind`    | Para quê                          | Campos                                           |
| --------- | --------------------------------- | ------------------------------------------------ |
| `'link'`  | Um item que leva a uma rota.      | `name`, `href`, `icon?`, `badge?`, `permission?` |
| `'group'` | Submenu recolhível.               | `name`, `icon?`, `items` (lista de `'link'`)     |
| `'title'` | Rótulo que separa seções do menu. | `name`                                           |

O item fica ativo na própria rota e nas rotas abaixo dela (`/clientes/123` mantém "Clientes" marcado). A raiz `/` só fica ativa na raiz.

## 3. O título do breadcrumb

Em `src/layout/routes.ts`, uma entrada por rota. Segmentos que começam com `:` aceitam qualquer valor:

```ts
export const routeTitles: RouteTitles = {
  '/': 'Início',
  '/sem-acesso': 'Sem acesso',
  '/clientes': 'Clientes',
  '/clientes/:id': 'Detalhe do cliente',
};
```

A trilha mostra um passo por prefixo da URL que tenha título. Se uma rota fixa (`/clientes/novo`) e uma com parâmetro (`/clientes/:id`) casarem com o mesmo endereço, vale a fixa. Dois títulos iguais seguidos viram um só. Rota sem título não aparece na trilha.

## 4. A permissão

A sessão traz `permissions: ReadonlySet<string>`, e o menu filtra por ela:

- **Sem `permission`** no item: aparece para qualquer sessão.
- **Com `permission`**: aparece só se a sessão tiver a string exata (`customers:read`).
- Um **grupo** some quando nenhum filho sobra, e um **título** some quando nenhum item da seção sobra.

Siga o formato `<recurso>:<ação>` (`customers:read`, `customers:write`) para as permissões ficarem previsíveis.

Atenção a dois pontos:

- O menu só **esconde** o item. Quem digitar `/clientes` na barra de endereço chega à página. Se a tela precisa ser protegida na interface, confira `useSession().permissions` nela e mostre o `ErrorState` ou redirecione para `/sem-acesso`.
- A proteção de verdade dos dados é do servidor que os entrega. Esconder um botão não é autorização.

Hoje a sessão é provisória e **não tem nenhuma permissão** (veja `src/core/session/session-context.tsx`). Para ver o item no menu enquanto desenvolve, passe uma sessão de teste em `value` ao `SessionProvider`, em `src/app/providers.tsx`, sem commitar essa alteração.

## 5. Estados, toast e modal

Os componentes de `src/shared/ui` cobrem os casos comuns de uma tela de dados. O exemplo abaixo junta todos, em `src/app/(painel)/clientes/customer-list.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CButton } from '@coreui/react';

import { ConfirmModal } from '@/shared/ui/confirm-modal';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/toast';

type Customer = { id: string; name: string };
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; detail: string }
  | { status: 'ready'; customers: Customer[] };

export function CustomerList() {
  const toast = useToast();
  // Troque este estado inicial pela sua chamada de dados.
  const [state, setState] = useState<LoadState>({
    status: 'ready',
    customers: [],
  });
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => setState({ status: 'loading' });

  const remove = async () => {
    setDeleting(true);
    try {
      // await api.deleteCustomer(toDelete.id);
      toast.success('Cliente excluído.');
    } catch {
      toast.danger('Não foi possível excluir o cliente.');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  if (state.status === 'loading') {
    return <LoadingState label="Carregando clientes…" />;
  }
  if (state.status === 'error') {
    return <ErrorState detail={state.detail} onRetry={reload} />;
  }
  if (state.customers.length === 0) {
    return (
      <EmptyState message="Nenhum cliente ainda.">
        <Link className="btn btn-primary" href="/clientes/novo">
          Novo cliente
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="list-group">
        {state.customers.map((customer) => (
          <li
            className="list-group-item d-flex justify-content-between"
            key={customer.id}
          >
            {customer.name}
            <CButton
              color="danger"
              onClick={() => setToDelete(customer)}
              size="sm"
              variant="outline"
            >
              Excluir
            </CButton>
          </li>
        ))}
      </ul>
      <ConfirmModal
        busy={deleting}
        confirmColor="danger"
        confirmLabel="Excluir"
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        title="Excluir cliente"
        visible={toDelete !== null}
      >
        Excluir {toDelete?.name}? Esta ação não pode ser desfeita.
      </ConfirmModal>
    </>
  );
}
```

### Referência rápida dos componentes

| Componente / hook | Props e métodos                                                                                                                   | Use quando                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `LoadingState`    | `rows` (5), `label` ("Carregando…")                                                                                               | A tela espera dados. Linhas piscando no lugar do conteúdo. |
| `EmptyState`      | `message`, `children` (a ação)                                                                                                    | A consulta voltou sem registros.                           |
| `ErrorState`      | `onRetry` (obrigatória), `message`, `detail`, `actionLabel` ("Tentar de novo"), `busy`                                            | A carga falhou e dá para tentar de novo.                   |
| `useToast()`      | `success`, `info`, `warning`, `danger` (cada um com `message` e `title?`), e `show(message, kind?, title?)`                       | Feedback curto de uma ação. Some sozinho em 5 segundos.    |
| `ConfirmModal`    | `visible`, `title`, `children`, `confirmLabel`, `cancelLabel`, `confirmColor`, `busy`, `confirmDisabled`, `onConfirm`, `onCancel` | Ação destrutiva ou irreversível.                           |

Sobre o `ConfirmModal`: a tela controla `visible`. Quem grava chama `onConfirm`, mostra `busy` enquanto grava e, no fim, fecha o modal passando `visible={false}`. Com `busy`, o modal trava os botões e o fechamento por teclado e fundo. `onConfirm` pode devolver uma promessa: enquanto ela não termina, um segundo clique é ignorado.

O `useToast()` só funciona dentro do `ToastProvider`, que já está na raiz (`src/app/providers.tsx`). Fora dele, o hook lança um erro.

## 6. Testes

- Regra de menu ou de breadcrumb nova: acrescente casos em `src/layout/nav.spec.ts` ou `src/layout/breadcrumbs.spec.ts`. Os arquivos `*.spec.ts` ficam ao lado do código e rodam no Vitest.
- Fluxo de tela: um teste de e2e em `apps/backoffice-e2e/src`.

Valide pela raiz do repositório:

```bash
pnpm format:check
pnpm nx lint backoffice
pnpm nx test backoffice
pnpm nx build backoffice
pnpm nx e2e backoffice-e2e
```

O `build` roda o `next build`, que também faz a checagem de tipos.

## Checklist

- [ ] `page.tsx` em `src/app/(painel)/<rota>/`, com `metadata.title`.
- [ ] Componentes com hooks marcados com `'use client'`.
- [ ] Item em `navItems`, com `permission` quando a área for restrita.
- [ ] Título em `routeTitles` (e das rotas filhas, como `:id`).
- [ ] Estados de carregando, vazio e erro tratados.
- [ ] Teste do que for regra de negócio da tela.
- [ ] Nenhum segredo em variável `NEXT_PUBLIC_*`.
