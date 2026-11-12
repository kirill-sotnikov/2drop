#!/bin/sh
set -eu

: "${TURN_DOMAIN:?Set TURN_DOMAIN}"
: "${TURN_PUBLIC_IP:?Set TURN_PUBLIC_IP}"
: "${TURN_SECRET:?Set TURN_SECRET}"

# Compose attaches coturn to one IPv4 Docker network. Discover the container's
# address on every start; Docker may assign a different address after recreation.
container_addresses="$(hostname -i)"
relay_ip=
for address in $container_addresses; do
  case "$address" in
    *:*|127.*) continue ;;
  esac
  if [ -n "$relay_ip" ]; then
    echo "coturn: expected one container IPv4 address" >&2
    exit 1
  fi
  relay_ip="$address"
done

case "$relay_ip" in
  ""|0.0.0.0)
    echo "coturn: could not determine a concrete container IPv4 address" >&2
    exit 1
    ;;
esac

# Explicit public/private mapping also permits this single private relay IP.
# Otherwise two clients on this TURN server can hit the private-peer deny rules.
# Invoke turnserver directly: the image's default entrypoint evals arguments.
exec turnserver \
  --log-file=stdout \
  -c /etc/coturn/turnserver.conf \
  --listening-ip="$relay_ip" \
  --relay-ip="$relay_ip" \
  --external-ip="$TURN_PUBLIC_IP/$relay_ip" \
  --realm="$TURN_DOMAIN" \
  --static-auth-secret="$TURN_SECRET"
