#!/usr/bin/env bash
# Renew only certificates used by the VITALOOP platform.

set -euo pipefail

for certificate in vitaloop.today staging-api.vitaloop.today vitaloop.softdab.tech; do
  /usr/bin/certbot renew --quiet --cert-name "$certificate"
done

/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
