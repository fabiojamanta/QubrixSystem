#!/usr/bin/env bash
# Carga inicial no Render (shell Linux) ou local com Python do sistema.
# Uso (a partir da raiz do repositório):
#   ./seed-system.sh
#   ./seed-system.sh --demo
#   ./seed-system.sh --demo --force
set -euo pipefail
cd "$(dirname "$0")/backend"
exec python seed_system.py "$@"
