#!/usr/bin/env bash
# Bootstrap de uma VM Ubuntu do Bimo (Oracle Cloud Always Free) — ver
# docs/DEPLOY.md para o passo a passo completo e o contexto de cada decisão.
#
# Uso (depois de já ter clonado o repo e feito `cd Bimo`):
#   bash scripts/bootstrap-vm.sh
#
# Idempotente: pode rodar de novo sem duplicar swap nem reinstalar Docker.
# Não mexe em Wallet, .env nem sobe os containers — isso continua manual
# (ver docs/DEPLOY.md passos 5-6), porque depende de segredos que este
# script não deve tocar.

set -euo pipefail

RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_MB=$((RAM_KB / 1024))

echo "== Bimo: bootstrap da VM =="
echo "RAM detectada: ${RAM_MB}MB"

if [ "$RAM_MB" -lt 4000 ]; then
  if swapon --show | grep -q '/swapfile'; then
    echo "[swap] /swapfile já está ativo, pulando."
  else
    echo "[swap] RAM baixa (<4GB) — criando 2GB de swap (necessário pro build Docker não estourar memória)..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
      echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    fi
    echo "[swap] pronto:"
    free -h
  fi
else
  echo "[swap] RAM confortável (>=4GB), não é necessário swap adicional."
fi

if command -v docker &> /dev/null; then
  echo "[docker] já instalado ($(docker --version)), pulando instalação."
else
  echo "[docker] instalando..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "[docker] instalado. Rode 'newgrp docker' (ou saia e entre de novo por SSH) antes de usar 'docker compose' sem sudo."
fi

echo ""
echo "== Bootstrap concluído. Próximos passos manuais (docs/DEPLOY.md): =="
echo "  1. Se esta é a VM da api: copie a Wallet do banco pra cá (scp) e extraia em ./wallet"
echo "  2. Crie o .env (cp apps/api/.env.example .env && edite os valores)"
echo "  3. Suba os containers:"
echo "     - VM da api:  docker compose -f docker-compose.api.yml up -d --build"
echo "     - VM do web:  NEXT_PUBLIC_API_URL=http://<IP_DA_VM_API>:3000 docker compose -f docker-compose.web.yml up -d --build"
echo "     - 1 VM só:    docker compose up -d --build"
