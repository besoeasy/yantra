#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run as root (use sudo)."
  exit 1
fi

TARGET_USER="${SUDO_USER:-}"
if [[ -z "$TARGET_USER" ]]; then
  TARGET_USER="root"
fi

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    echo "Docker already installed."
    return
  fi

  echo "Installing Docker..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  ARCH="$(dpkg --print-architecture)"
  OS_ID="$(. /etc/os-release && echo "$ID")"
  RELEASE="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
    echo "Unsupported OS: $OS_ID"
    exit 1
  fi

  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_ID $RELEASE stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

configure_docker_permissions() {
  if [[ "$TARGET_USER" == "root" ]]; then
    return
  fi

  if getent group docker >/dev/null 2>&1; then
    usermod -aG docker "$TARGET_USER"
  else
    groupadd docker
    usermod -aG docker "$TARGET_USER"
  fi
}

configure_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
      ufw allow 80/tcp
      ufw allow 443/tcp
    fi
  fi
}

run_yantra() {
  if docker ps -a --format '{{.Names}}' | grep -q '^yantra$'; then
    echo "Yantra container already exists."
    return
  fi

  echo "Starting Yantra..."
  docker run -d \
    --name yantra \
    -p 80:5252 \
    -p 443:5252 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    --restart unless-stopped \
    ghcr.io/besoeasy/yantra
}

install_docker
configure_docker_permissions
configure_firewall
run_yantra

echo "Done. Open http://localhost in your browser."
if [[ "$TARGET_USER" != "root" ]]; then
  echo "Log out and back in to apply docker group changes for $TARGET_USER."
fi
