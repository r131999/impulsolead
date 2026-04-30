# Deploy ImpulsoLead — Easypanel

## Arquitetura no servidor

```
Easypanel VPS
├── impulso_postgres  (PostgreSQL 16 — já existe)
├── impulso_server    (Node.js API — porta 3002)
└── impulso_client    (Nginx + React build — porta 80)
```

O nginx do client proxia `/api/*` para o server internamente.
Somente o client precisa de domínio público (`crm.impulsoslz.com.br`).

---

## Pré-requisito: repositório Git

Easypanel clona o repositório para fazer o build. Suba o código para o GitHub/GitLab:

```bash
git init
git add .
git commit -m "feat: ImpulsoLead v1"
git remote add origin git@github.com:SEU_USUARIO/impulsolead.git
git push -u origin main
```

> Certifique-se de que `.env` está no `.gitignore` (nunca comite credenciais).

---

## 1. Serviço do servidor (API)

No painel do Easypanel → **New Service → App**:

| Campo | Valor |
|---|---|
| **Name** | `impulso-server` |
| **Repository** | URL do seu repositório |
| **Branch** | `main` |
| **Build type** | Dockerfile |
| **Dockerfile path** | `Dockerfile.server` |
| **Exposed port** | `3002` |
| **Domain** | *(deixe vazio — acesso apenas interno)* |

### Variáveis de ambiente do server

Vá em **Environment** e adicione:

```
DATABASE_URL=postgresql://postgres:SUA_SENHA@impulso_postgres:5432/impulso
JWT_SECRET=string_aleatoria_longa_minimo_32_chars
JWT_EXPIRES_IN=7d
PORT=3002
NODE_ENV=production
CLIENT_URL=https://crm.impulsoslz.com.br
NOTIFICACAO_WEBHOOK_URL=https://seu-n8n.com/webhook/lead
```

> `impulso_postgres` é o hostname interno do PostgreSQL no Easypanel.  
> `NOTIFICACAO_WEBHOOK_URL` pode ficar vazio se não quiser notificações ainda.

---

## 2. Serviço do client (Frontend)

No painel → **New Service → App**:

| Campo | Valor |
|---|---|
| **Name** | `impulso-client` |
| **Repository** | URL do seu repositório |
| **Branch** | `main` |
| **Build type** | Dockerfile |
| **Dockerfile path** | `Dockerfile.client` |
| **Exposed port** | `80` |
| **Domain** | `crm.impulsoslz.com.br` |
| **HTTPS** | Ativado (Let's Encrypt automático) |

### Variáveis de ambiente do client

```
BACKEND_URL=http://impulso-server:3002
```

> `impulso-server` é o nome do serviço que você criou no passo anterior.  
> O nginx usa esse valor para fazer proxy de `/api/*` internamente — sem expor o backend para a internet.

---

## 3. Primeira inicialização

Na primeira subida, o `entrypoint.sh` do servidor vai:

1. Aguardar o PostgreSQL ficar disponível (retry automático)
2. Rodar `prisma migrate deploy` — cria todas as tabelas
3. Iniciar o servidor Node.js

Acompanhe os logs em **Logs** no Easypanel para confirmar:

```
Aguardando banco de dados...
DB pronto
Rodando migrations...
Migrations aplicadas com sucesso.
Iniciando servidor...
ImpulsoLead API rodando na porta 3002
```

---

## 4. Verificação pós-deploy

```bash
# Health check da API (substitua pelo domínio se exposto, ou use o terminal do Easypanel)
curl http://impulso-server:3002/api/health

# Esperado:
# {"status":"ok","timestamp":"..."}
```

Acesse `https://crm.impulsoslz.com.br` — deve aparecer a tela de login do ImpulsoLead.

---

## Redeploy após mudanças

No Easypanel, clique em **Redeploy** em cada serviço afetado.  
O entrypoint roda `prisma migrate deploy` automaticamente — novas migrations são aplicadas sem apagar dados.

---

## Teste local com Docker Compose

```bash
# 1. Crie o .env na raiz do projeto
cp .env.example .env
# Edite .env com suas senhas

# 2. Suba tudo
docker compose up -d --build

# 3. Acesse
# Frontend: http://localhost
# API:      http://localhost:3002/api/health
```

---

## Variáveis de ambiente — referência completa

| Variável | Onde usar | Descrição |
|---|---|---|
| `POSTGRES_PASSWORD` | `.env` local | Senha do PostgreSQL |
| `DATABASE_URL` | server | Connection string completa |
| `JWT_SECRET` | server | Segredo para assinar tokens JWT |
| `JWT_EXPIRES_IN` | server | Validade do token (`7d`, `30d`) |
| `CLIENT_URL` | server | Origem permitida no CORS |
| `NOTIFICACAO_WEBHOOK_URL` | server | Webhook N8N para notificar corretor |
| `BACKEND_URL` | client (nginx) | URL interna do servidor para proxy |
