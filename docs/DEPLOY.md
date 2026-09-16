# Deploy do Bimo na Oracle Cloud (Always Free)

Guia para colocar `apps/api` e `apps/web` no ar usando o Autonomous Database
já provisionado (RNF-ARCH). Não cobre alta disponibilidade/multi-instância —
é o suficiente para o piloto do MVP.

Duas topologias possíveis, dependendo da capacidade disponível na sua conta:

- **1 VM Ampere A1.Flex** (2-4 OCPU / 8-24GB) rodando `api` + `web` juntos —
  ideal, mas a capacidade Ampere grátis esgota com frequência (erro "Out of
  capacity") e pode não sair na hora.
- **2 VMs `VM.Standard.E2.1.Micro`** (1 OCPU / 1GB RAM cada), uma só para a
  `api` e outra só para o `web` — sempre disponível no Always Free (2
  instâncias AMD micro garantidas), mas cada VM é bem mais apertada. Esse
  guia cobre as duas; onde os passos divergem, cada opção está marcada.

## 1. Criar a(s) VM(s) Compute (Always Free)

No console OCI (mesmo tenancy onde está o Autonomous Database):

1. Menu ☰ → **Compute** → **Instances** → **Create instance**
2. **Name**: `bimo-vm` (topologia de 1 VM) ou `bimo-api-vm`/`bimo-web-vm`
   (topologia de 2 VMs)
3. **Image and shape** → **Edit**:
   - Image: **Canonical Ubuntu** (a versão mais recente disponível)
   - Shape: tente primeiro **Ampere → VM.Standard.A1.Flex** (2-4 OCPU / 8-24GB,
     marque **Always Free eligible**). Se der **"Out of capacity"**, é comum —
     a demanda por Ampere grátis é alta. Nesse caso use
     **AMD → VM.Standard.E2.1.Micro** (1 OCPU/1GB, sempre disponível) e crie
     **duas** instâncias com esse shape em vez de uma (uma para `api`, outra
     para `web`) — o Always Free garante 2 dessas.
4. **Networking**: na primeira VM, deixe **"Create new virtual cloud network"**
   com **"Create new public subnet"** (o Oracle cria os dois juntos). Na
   segunda VM (se for a topologia de 2 VMs), use **"Select existing virtual
   cloud network"** e escolha a mesma VCN/subnet já criada. Ligue o toggle
   **"Automatically assign public IPv4 address"** em Networking → Edit — se
   ele aparecer travado/cinza com o aviso "you must select a public subnet",
   confirme que "Create new public subnet" está mesmo selecionado (não
   "Select existing subnet") e tente reselecionar o campo.
5. **Add SSH keys**: cole sua chave pública (ou gere uma nova ali mesmo e
   baixe a privada — sem ela você não consegue entrar na VM depois)
6. **Create**

Se a instância sair com **`Public IP address: -`** (sem IP), adicione depois:
página da instância → **Attached VNICs** → clique na VNIC → na linha do IP
privado, menu ⋮ → **Edit** → mude "Public IP Address" para **Ephemeral
public IP**.

Repita para a segunda VM se for a topologia de 2 VMs. No fim, anote os
**Public IP address** de cada uma.

## 2. Abrir as portas 80/443 (e 22 para SSH)

No mesmo menu da instância → **Subnet** → **Default Security List** (ou a
Network Security Group que você usou) → **Add Ingress Rules**:
- Porta 22 (SSH) — já vem aberta por padrão na VCN padrão
- Porta 80 (HTTP) — Source `0.0.0.0/0`
- Porta 443 (HTTPS) — Source `0.0.0.0/0`

A VM Ubuntu também tem um firewall local (`iptables`/`ufw`) que costuma vir
bloqueando por padrão — depois de conectar por SSH, libere lá também:
```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save   # se o pacote estiver instalado
```

## 3. Conectar, adicionar swap e instalar Docker

```bash
ssh -i sua-chave.pem ubuntu@<PUBLIC_IP>
```

**Se a VM for `VM.Standard.E2.1.Micro` (1GB RAM), adicione swap antes de
qualquer build Docker** — sem isso, `npm run build`/`docker build` do
Next.js ou do NestJS têm boa chance de matar o processo por falta de
memória. Com Ampere (8GB+) isso é opcional:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # confirma que o swap apareceu
```

Docker + Compose plugin (mesmo comando nas duas topologias):
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

Repita esse passo 3 inteiro em cada VM, se for a topologia de 2 VMs.

**Atalho**: depois de clonar o repo (próximo passo), `bash
scripts/bootstrap-vm.sh` faz o swap + instalação do Docker acima de uma vez
só (detecta RAM da VM, só cria swap se for baixa, idempotente — pode rodar
de novo sem duplicar nada).

## 4. Levar o código para a VM

Opção simples (clonar do GitHub), em cada VM:
```bash
git clone https://github.com/caiosilvaazeredo/Bimo.git
cd Bimo
git checkout claude/pensive-dijkstra-3s3dva   # ou a branch/tag que for para produção
```

## 5. Colocar a Wallet e o `.env`

**Só a VM da `api` precisa da Wallet** (o `web` não fala com o banco
diretamente). **Nunca** suba a Wallet pro GitHub — ela some com o
`git clone`, então precisa ser copiada manualmente:
```bash
# Da sua máquina local, copie o zip da Wallet pra VM da api:
scp -i sua-chave.pem Wallet_bimodb.zip ubuntu@<IP_DA_VM_API>:~/Bimo/

# Já dentro da VM da api:
cd ~/Bimo
unzip Wallet_bimodb.zip -d wallet
rm Wallet_bimodb.zip
```

Crie o `.env` na raiz do projeto **da VM da api** (é o que os `docker-compose*.yml` leem):
```bash
cp apps/api/.env.example .env
nano .env
```
Preencha pelo menos:
- `DB_CONNECT_STRING=bimodb_medium` (ou o alias que preferir do `tnsnames.ora`)
- `DB_USERNAME=ADMIN`
- `DB_PASSWORD=<senha do ADMIN>`
- `KMS_DATA_KEY` — gere com `openssl rand -base64 32`
- `JWT_SECRET` — gere com `openssl rand -hex 32`
- `ADMIN_BOOTSTRAP_SECRET` — gere com `openssl rand -hex 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_CALLBACK_URL`
- `FRONTEND_URL=https://seu-dominio.com` (ou `http://<PUBLIC_IP>:3001` sem domínio ainda)

O `docker-compose.yml` já monta `./wallet` dentro do container da API em
`/wallet` e seta `TNS_ADMIN`/`DB_WALLET_LOCATION` automaticamente — não
precisa repetir isso no `.env`.

Não esqueça de ajustar os **redirect URIs** cadastrados no Google Cloud
Console e no Microsoft Entra ID para apontar pro domínio/IP real da VM da
api (`https://.../auth/google/callback` e `.../auth/microsoft/callback`),
senão o login OAuth falha.

## 6. Subir os containers

**Topologia de 1 VM** (api + web juntos):
```bash
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com docker compose up -d --build
```
(sem domínio ainda, use `http://<PUBLIC_IP>:3000` como `NEXT_PUBLIC_API_URL`)

**Topologia de 2 VMs** — na VM da api:
```bash
docker compose -f docker-compose.api.yml up -d --build
```
Na VM do web (o `NEXT_PUBLIC_API_URL` aponta pro IP/domínio **da VM da api**,
não `localhost`):
```bash
NEXT_PUBLIC_API_URL=http://<IP_DA_VM_API>:3000 \
  docker compose -f docker-compose.web.yml up -d --build
```
(troque por `https://api.seu-dominio.com` depois que tiver domínio+HTTPS —
ver passo 8)

Em qualquer topologia, confira que os containers subiram:
```bash
docker compose ps      # (ou docker compose -f docker-compose.api.yml ps)
docker compose logs -f api   # acompanhar erros de conexão com o banco
```

Teste rápido (na VM da api):
```bash
curl http://localhost:3000/health
```

## 7. Rodar as migrations do banco

O banco começa vazio (13 tabelas, uma por entidade). Rode a migration
inicial (`src/migrations/1758000000000-InitialSchema.ts`) antes de usar a
API pela primeira vez — ela não roda sozinha no boot, é um passo manual:

A imagem Docker de produção da API não tem `ts-node`/TypeScript instalados
(só o `dist/` já compilado), então rode a migration direto na VM, fora do
container, com um `npm install` completo (não o `--omit=dev` da imagem):

```bash
cd ~/Bimo
npm install --workspace apps/api --include-workspace-root
cd apps/api
export TNS_ADMIN=~/Bimo/wallet
# use as mesmas DB_* do seu .env (export manual ou `set -a; source ../../.env; set +a`)
npm run migration:run
```

Para conferir o que já rodou: `npm run migration:show`. Para desfazer a
última migration: `npm run migration:revert`. Só precisa repetir isso
quando uma migration nova for adicionada ao repositório — não é algo do
dia a dia.

## 8. (Recomendado) Domínio + HTTPS

Sem HTTPS, OAuth de produção do Google/Microsoft tende a recusar o
redirect. Caminho mais simples: apontar um domínio (ou subdomínio) pra cada
VM e usar o **Caddy** como reverse proxy (emite certificado Let's Encrypt
sozinho, sem configuração manual). Instale em cada VM que for expor domínio:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**Topologia de 1 VM** — `/etc/caddy/Caddyfile`:
```
seu-dominio.com {
  reverse_proxy localhost:3001
}

api.seu-dominio.com {
  reverse_proxy localhost:3000
}
```

**Topologia de 2 VMs** — `/etc/caddy/Caddyfile` na VM do web aponta só pro
`web` local, e o da VM da api só pro `api` local (cada domínio resolve via
DNS pro IP da VM certa, não pelo Caddy):
```
# Na VM do web (DNS de seu-dominio.com → IP da VM do web):
seu-dominio.com {
  reverse_proxy localhost:3001
}
```
```
# Na VM da api (DNS de api.seu-dominio.com → IP da VM da api):
api.seu-dominio.com {
  reverse_proxy localhost:3000
}
```

Em qualquer caso:
```bash
sudo systemctl reload caddy
```

## 9. Manter no ar

`docker compose` com `restart: unless-stopped` (já configurado) faz os
containers voltarem sozinhos depois de um reboot da VM, desde que o Docker
esteja habilitado no boot:
```bash
sudo systemctl enable docker
```

## Limites do Always Free a ter em mente

- VM Ampere A1: até 4 OCPU / 24GB no total da conta — dá pra rodar api + web
  + Caddy confortavelmente numa fração disso. Capacidade costuma esgotar
  ("Out of capacity"); vale tentar de novo em outro horário.
- VM AMD `E2.1.Micro`: 2 instâncias grátis garantidas, 1 OCPU/1GB cada —
  sempre disponível, mas exige swap (ver passo 3) pra sobreviver ao build
  Docker, e é apertado pra rodar mais do que um serviço por VM.
- Egress de rede: 10TB/mês grátis — não é limitante pro piloto.
- Autonomous Database Always Free: 20GB de storage, 1 OCPU — suficiente
  pro piloto, mas monitore o crescimento das tabelas de log/auditoria.
