# Deploy do Bimo na Oracle Cloud (Always Free)

Guia para colocar `apps/api` e `apps/web` no ar numa única VM Always Free,
usando o Autonomous Database já provisionado (RNF-ARCH). Não cobre alta
disponibilidade/multi-instância — é o suficiente para o piloto do MVP.

## 1. Criar a VM Compute (Always Free)

No console OCI (mesmo tenancy onde está o Autonomous Database):

1. Menu ☰ → **Compute** → **Instances** → **Create instance**
2. **Name**: `bimo-vm`
3. **Image and shape** → **Edit**:
   - Image: **Canonical Ubuntu** (22.04 ou mais recente)
   - Shape: **Ampere** → **VM.Standard.A1.Flex** — marque **Always Free eligible**
     (o Always Free dá até 4 OCPUs / 24GB de RAM em Ampere; 2-4 OCPUs / 8-12GB
     já é confortável para rodar api + web + reverse proxy)
4. **Networking**: use a VCN padrão (ou crie uma) com um **Public Subnet** e
   marque **Assign a public IPv4 address**
5. **Add SSH keys**: cole sua chave pública (ou gere uma nova ali mesmo e
   baixe a privada — sem ela você não consegue entrar na VM depois)
6. **Create**

Depois de criada, anote o **Public IP address** da instância.

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

## 3. Conectar e instalar Docker

```bash
ssh -i sua-chave.pem ubuntu@<PUBLIC_IP>

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Levar o código para a VM

Opção simples (clonar do GitHub):
```bash
git clone https://github.com/caiosilvaazeredo/Bimo.git
cd Bimo
git checkout claude/pensive-dijkstra-3s3dva   # ou a branch/tag que for para produção
```

## 5. Colocar a Wallet e o `.env`

**Nunca** suba a Wallet pro GitHub — ela some com o `git clone`, então precisa
ser copiada manualmente pra dentro da VM:
```bash
# Da sua máquina local, copie o zip da Wallet pra VM:
scp -i sua-chave.pem Wallet_bimodb.zip ubuntu@<PUBLIC_IP>:~/Bimo/

# Já dentro da VM:
cd ~/Bimo
unzip Wallet_bimodb.zip -d wallet
rm Wallet_bimodb.zip
```

Crie o `.env` na raiz do projeto (é o que o `docker-compose.yml` lê):
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
Console e no Microsoft Entra ID para apontar pro domínio/IP real da VM
(`https://.../auth/google/callback` e `.../auth/microsoft/callback`), senão
o login OAuth falha.

## 6. Subir os containers

```bash
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com docker compose up -d --build
```
(sem domínio ainda, use `http://<PUBLIC_IP>:3000` como `NEXT_PUBLIC_API_URL`)

```bash
docker compose ps      # confirma os dois serviços "Up"
docker compose logs -f api   # acompanhar erros de conexão com o banco
```

Teste rápido:
```bash
curl http://localhost:3000/health
```

## 7. Rodar as migrations do banco

O banco começa vazio — depois que a API conseguir conectar, aplique as
migrations do TypeORM (`npm run typeorm migration:run` de dentro do
container, ou via um job separado — ver instruções específicas quando as
migrations forem geradas).

## 8. (Recomendado) Domínio + HTTPS

Sem HTTPS, OAuth de produção do Google/Microsoft tende a recusar o
redirect. Caminho mais simples: apontar um domínio (ou subdomínio) pro
`<PUBLIC_IP>` da VM e usar o **Caddy** como reverse proxy (emite certificado
Let's Encrypt sozinho, sem configuração manual):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:
```
seu-dominio.com {
  reverse_proxy localhost:3001
}

api.seu-dominio.com {
  reverse_proxy localhost:3000
}
```
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
  + Caddy confortavelmente numa fração disso.
- Egress de rede: 10TB/mês grátis — não é limitante pro piloto.
- Autonomous Database Always Free: 20GB de storage, 1 OCPU — suficiente
  pro piloto, mas monitore o crescimento das tabelas de log/auditoria.
