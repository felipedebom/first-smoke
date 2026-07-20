# Empório Reis do Sabor · ZYRON

Sistema de gestão comercial do Empório Reis do Sabor. A V1 centraliza produtos, estoque, entradas, vendas, fiado, relatórios, histórico e usuários.

## Para entrar no sistema pela primeira vez

O acesso é criado no Firebase uma única vez pelo administrador. Faça assim:

1. Crie ou selecione o projeto Firebase exclusivo do Empório.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Em **Authentication → Users**, clique em **Add user** e crie o seu e-mail e senha.
4. Copie o **UID** desse usuário.
5. Em **Firestore Database**, crie a coleção `usuarios` e um documento cujo ID seja exatamente o UID copiado.
6. Adicione os campos abaixo ao documento:

```json
{
  "nome": "Seu nome",
  "email": "seu@email.com",
  "role": "super_admin"
}
```

7. Preencha o arquivo `.env` com as chaves do mesmo projeto Firebase e execute `npm run dev`.

Depois disso, entre com o e-mail e a senha criados no passo 3. O perfil `super_admin` libera a tela **Usuários**, onde você pode ajustar os demais acessos.

> O Firebase Console ignora as regras do Firestore; por isso ele é usado para criar o primeiro usuário administrador com segurança.

## Configuração local

```bash
cd emporio-reis-do-sabor
copy .env.example .env
npm install
npm run dev
```

Preencha `.env` com as credenciais do projeto Firebase do Empório:

```bash
VITE_FIREBASE_API_KEY=SUA_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=SEU_PROJETO.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=SEU_PROJETO
VITE_FIREBASE_STORAGE_BUCKET=SEU_PROJETO.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxxxxxx
```

## Módulos incluídos

- **Dashboard:** vendas do dia e do mês, estoque baixo, valor em estoque, fiado, últimas vendas e indicadores semanais.
- **Produtos:** cadastro com categoria, preços de venda e custo, estoque mínimo e status.
- **Estoque:** posição atual, alertas e valor estimado.
- **Entradas:** compras e produção na mesma tela, com atualização imediata do estoque.
- **Vendas:** caixa com busca de produto, carrinho, PIX, dinheiro, cartão, fiado e cálculo de troco.
- **Fiado:** valores em aberto e baixa de pagamentos.
- **Relatórios:** período, produtos mais vendidos, pagamentos, entradas, estoque baixo e exportação de vendas em CSV.
- **Histórico:** registro automático das ações importantes.
- **Usuários:** perfis de super administrador, administrador e funcionário.

## Segurança e publicação

As regras em `firestore.rules` separam permissões de administrador e funcionário. Antes de publicar, associe o projeto Firebase correto e envie as regras:

```bash
firebase use --add
firebase deploy --only firestore:rules
```

Para gerar a versão de produção:

```bash
npm run build
```

`node_modules/` e `dist/` são gerados localmente e não devem ser versionados.
