
#!/usr/bin/env bash
set -euo pipefail

URL="https://raw.githubusercontent.com/louislam/uptime-kuma/master/compose.yaml"
PROJECT_DIR="uptime-kuma"

echo_stderr() { printf "%s\n" "$*" >&2; }

info() { printf "[INFO] %s\n" "$*"; }
error() { printf "[ERROR] %s\n" >&2; }

usage() {
  cat <<EOF
Usage: $0 [up|down|help]

No arguments (default): ensures Docker is installed, downloads compose.yaml, and starts the service (up -d).
up    : ensure Docker and compose.yaml present, then start the service (docker compose up -d).
down  : stop and remove containers (docker compose down).
help  : show this help.
EOF
}

ACTION="${1:-}" 
case "$ACTION" in
  -h|--help|help)
    usage
    exit 0
    ;;
  up|down|"")
    # valid
    ;;
  *)
    error "Unknown action: $ACTION"
    usage
    exit 2
    ;;
esac

if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

# Ensure Docker is installed (we attempt install if missing)
info "Checking for Docker..."
if command -v docker >/dev/null 2>&1; then
  info "Docker is already installed: $(docker --version 2>/dev/null || true)"
else
  info "Docker not found. Attempting to install Docker using the official convenience script."
  if ! command -v curl >/dev/null 2>&1; then
    info "Installing curl (required to fetch Docker installer)..."
    if command -v apt-get >/dev/null 2>&1; then
      $SUDO apt-get update
      $SUDO apt-get install -y curl ca-certificates gnupg lsb-release
    elif command -v apk >/dev/null 2>&1; then
      $SUDO apk add --no-cache curl
    elif command -v dnf >/dev/null 2>&1; then
      $SUDO dnf install -y curl
    elif command -v yum >/dev/null 2>&1; then
      $SUDO yum install -y curl
    else
      error "No known package manager found to install curl. Please install Docker manually: https://docs.docker.com/get-docker/"
      exit 1
    fi
  fi

  info "Running Docker install script (from https://get.docker.com). This may ask for your password."
  $SUDO sh -c "curl -fsSL https://get.docker.com | sh"

  if command -v systemctl >/dev/null 2>&1; then
    info "Enabling and starting Docker service..."
    $SUDO systemctl enable --now docker || true
  fi

  if ! command -v docker >/dev/null 2>&1; then
    error "Docker installation appears to have failed. Please install Docker manually: https://docs.docker.com/get-docker/"
    exit 1
  fi
  info "Docker installed: $(docker --version 2>/dev/null || true)"
fi

# Determine docker compose command
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
else
  info "Docker Compose not found as a plugin or binary. Attempting to install docker-compose package where possible."
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update
    $SUDO apt-get install -y docker-compose || true
  fi
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
  else
    error "docker compose is not available. Please install Compose plugin or binary."
    exit 1
  fi
fi

# Helper to ensure project dir and compose.yaml exist when needed
ensure_compose() {
  if [ ! -d "$PROJECT_DIR" ]; then
    info "Creating project directory '$PROJECT_DIR'"
    mkdir -p "$PROJECT_DIR"
  fi
  cd "$PROJECT_DIR"

  if [ ! -f compose.yaml ]; then
    info "Downloading compose.yaml into $PROJECT_DIR"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL -o compose.yaml "$URL" || { error "Failed to download compose.yaml"; exit 1; }
    elif command -v wget >/dev/null 2>&1; then
      wget -qO compose.yaml "$URL" || { error "Failed to download compose.yaml"; exit 1; }
    else
      error "Neither curl nor wget is available to download compose.yaml. Please install one and re-run."
      exit 1
    fi
  else
    info "compose.yaml already exists in $PROJECT_DIR"
  fi
}

case "$ACTION" in
  down)
    if [ ! -d "$PROJECT_DIR" ]; then
      error "Project directory '$PROJECT_DIR' not found. Nothing to stop."
      exit 1
    fi
    cd "$PROJECT_DIR"
    info "Stopping and removing containers: $DOCKER_COMPOSE_CMD down"
    set +e
    $SUDO $DOCKER_COMPOSE_CMD down
    RC=$?
    set -e
    if [ $RC -ne 0 ]; then
      error "Failed to stop containers (exit code $RC). Try running: $DOCKER_COMPOSE_CMD down"
      exit $RC
    fi
    info "Containers stopped."
    ;;
  up|"")
    ensure_compose
    info "Starting containers: $DOCKER_COMPOSE_CMD up -d"
    set +e
    $SUDO $DOCKER_COMPOSE_CMD up -d
    RC=$?
    set -e
    if [ $RC -ne 0 ]; then
      error "Failed to start containers (exit code $RC). Try running: $DOCKER_COMPOSE_CMD up -d"
      exit $RC
    fi
    info "Uptime Kuma should now be starting. To see logs: $DOCKER_COMPOSE_CMD logs -f"
    ;;
esac

info "Done."

exit 0
