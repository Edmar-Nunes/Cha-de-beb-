# 🍼 Chá de Bebê — Sistema de Lista de Presentes

Site completo para lista de presentes de chá de bebê, com autenticação, banco de dados em tempo real via Supabase, e notificação por e-mail ao admin quando um convidado escolhe um presente.

---

## 📁 Estrutura do Projeto

```
cha-de-bebe/
├── index.html                          # Lista de presentes (convidados)
├── login.html                          # Login / cadastro
├── admin.html                          # Painel administrativo
├── auth.js                             # Autenticação + notificação ao admin
├── supabase/
│   └── functions/
│       └── notify-admin/
│           └── index.ts               # Edge Function: envio de e-mail
└── README.md
```

---

## 🚀 Deploy no GitHub Pages

### 1. Criar repositório

```bash
git init
git add .
git commit -m "initial commit"
gh repo create cha-de-bebe --public --push --source=.
```

### 2. Activar GitHub Pages

No GitHub:
1. Vá em **Settings → Pages**
2. Em **Source**, seleccione `main` branch e pasta `/ (root)`
3. Clique **Save**

Após alguns segundos, o site estará disponível em:
```
https://<seu-usuario>.github.io/cha-de-bebe/
```

> **Importante:** O GitHub Pages serve apenas ficheiros estáticos. O banco de dados e a autenticação são 100% geridos pelo Supabase via API — não é preciso servidor próprio.

---

## 🗄️ Configurar Supabase

### 1. Executar o SQL

No [Supabase Dashboard](https://app.supabase.com) → **SQL Editor**, execute o ficheiro SQL completo do projecto (cria tabelas, triggers, RLS e configurações iniciais).

### 2. Adicionar configuração `admin_email`

Adicione esta linha ao `INSERT` das configurações (ou execute separadamente):

```sql
INSERT INTO configuracoes (chave, valor, descricao) VALUES
('admin_email', 'seu@email.com', 'E-mail do administrador para notificações');
```

### 3. Criar o utilizador admin

No SQL Editor do Supabase, execute:

```sql
SELECT auth.create_user(
  jsonb_build_object(
    'email', 'admin@seudominio.com',
    'password', 'SenhaForte@123',
    'email_confirm', true,
    'raw_user_meta_data', jsonb_build_object(
      'nome', 'Administrador',
      'telefone', '(11) 99999-9999',
      'tipo', 'admin'
    )
  )
);
```

---

## 📧 Configurar Notificações por E-mail (Resend + Edge Function)

Quando um convidado escolhe um presente ou contribui via PIX, o admin recebe um e-mail automático. O envio é feito pela Edge Function `notify-admin`.

### 1. Criar conta no Resend

1. Acesse [resend.com](https://resend.com) e crie uma conta gratuita
2. Vá em **API Keys** e crie uma nova chave
3. Em **Domains**, adicione e verifique o seu domínio (ou use o domínio de teste do Resend)

### 2. Instalar o Supabase CLI

```bash
npm install -g supabase
supabase login
```

### 3. Fazer o deploy da Edge Function

```bash
# Na raiz do projecto
supabase functions deploy notify-admin --project-ref dghwfnustgwjeydcandg
```

### 4. Definir as variáveis de ambiente

No [Supabase Dashboard](https://app.supabase.com) → **Settings → Edge Functions → Secrets**, adicione:

| Variável         | Valor                                   |
|------------------|-----------------------------------------|
| `RESEND_API_KEY` | Sua chave do Resend (`re_...`)          |
| `ADMIN_EMAIL`    | E-mail do admin que receberá alertas    |
| `FROM_EMAIL`     | `Chá de Bebê <noreply@seudominio.com>` |

Ou via CLI:

```bash
supabase secrets set RESEND_API_KEY=re_xxxx --project-ref dghwfnustgwjeydcandg
supabase secrets set ADMIN_EMAIL=admin@seudominio.com --project-ref dghwfnustgwjeydcandg
supabase secrets set FROM_EMAIL="Chá de Bebê <noreply@seudominio.com>" --project-ref dghwfnustgwjeydcandg
```

### 5. Testar o envio

```bash
curl -X POST https://dghwfnustgwjeydcandg.supabase.co/functions/v1/notify-admin \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "nova_escolha",
    "convidado": { "nome": "Teste", "email": "teste@email.com" },
    "presente": { "titulo": "Kit de Banho", "preco": 150.00 },
    "pagamento": { "tipo": "pix", "valor": 150.00 },
    "data": "2026-01-01T10:00:00Z"
  }'
```

---

## 🔒 Políticas de Segurança (RLS)

O projecto usa Row Level Security (RLS) do Supabase. As regras garantem:

- **Convidados** só veem e alteram os próprios dados
- **Presentes e configurações** são visíveis a todos, mas só o admin pode editar
- **Escolhas** são privadas — cada utilizador só vê a sua própria

---

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 🔐 Autenticação | Login/cadastro com email e senha via Supabase Auth |
| 🎁 Lista de presentes | Grid responsivo com imagens, preço, estoque |
| 💰 PIX | Botão de contribuição via PIX integrado |
| 💬 Comentários | Sistema de comentários por presente com reações emoji |
| 📧 Notificação | E-mail automático ao admin quando presente é escolhido |
| ⚙️ Painel admin | CRUD completo de presentes, visualização de escolhas e convidados |
| 📱 Responsivo | Funciona em mobile, tablet e desktop |
| 🌐 GitHub Pages | Deploy gratuito — sem servidor |

---

## 🛠️ Personalização

Edite o ficheiro `auth.js` para alterar a URL e a chave do Supabase:

```js
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

---

## 📄 Licença

Projecto privado — uso exclusivo do evento.
