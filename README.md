# Jornal da Associação

Blog privado com edições mensais para um grupo de amigos. Só entra quem tem conta; não há registo público.

- Next.js (App Router) + TypeScript + Tailwind
- Postgres na Neon via `@neondatabase/serverless` (SQL simples, sem ORM)
- Autenticação própria: `bcryptjs` + sessão JWT (`jose`) em cookie httpOnly, 30 dias
- Markdown com `react-markdown` + `remark-gfm`, sem HTML raw
- Deploy na Vercel: cada push em `main` vai para produção

## Funcionalidades

- Primeira página com a edição atual em destaque e as edições anteriores
- Posts por edição (`/edicao/AAAA-MM`), página do post com comentários
- Editor Markdown com pré-visualização: guardar rascunho, publicar agora ou agendar (hora de Lisboa)
- Um post agendado só fica visível quando chega a hora; até lá só o autor e os admins o veem (em `/meus`)
- Cada pessoa edita e apaga os seus posts e comentários; um admin pode apagar tudo
- `/conta` para mudar a password

## Setup local

Requer Node.js 20+ e uma base de dados Postgres na Neon (recomendado: um branch `dev` só para desenvolvimento).

```bash
npm install
cp .env.example .env.local   # preenche DATABASE_URL e SESSION_SECRET
npm run db:init              # cria tabelas, índices e a view
npm run create-user -- --email eu@exemplo.pt --name "O Meu Nome" --admin
npm run dev
```

Gera um `SESSION_SECRET` com `openssl rand -base64 48`.

## Produção

As variáveis `DATABASE_URL` (branch `main` da Neon) e `SESSION_SECRET` estão definidas na Vercel, ambiente Production.

### Aplicar o schema

O `schema.sql` é idempotente; pode correr-se as vezes que for preciso:

```bash
DATABASE_URL="<connection string do branch main>" npm run db:init
```

### Criar utilizadores

O script pede a password no terminal (não fica no histórico). Se o email já existir, atualiza o nome, a password e o papel de admin — serve também para repor passwords.

```bash
DATABASE_URL="<connection string do branch main>" npm run create-user -- --email alguem@exemplo.pt --name "Nome" [--admin]
```

A connection string obtém-se no painel da Neon ou com `npx neonctl connection-string main --project-id <id> --pooled`.

### Redeploy

Qualquer push para `main` faz deploy automático. Para forçar um redeploy sem alterações de código (por exemplo, depois de mudar variáveis de ambiente):

```bash
npx vercel --prod
```

ou `npx vercel redeploy <url-do-último-deploy>`.
