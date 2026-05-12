#!/usr/bin/env bash
set -euo pipefail

if ! (return 0 2>/dev/null); then
  echo "This script must be sourced to keep exports in your current shell."
  echo "Usage: source scripts/enter-stripe-secrets.sh"
  exit 1
fi

prompt_secret() {
  local var_name="$1"
  local label="$2"
  local value=""
  read -r -s -p "$label: " value
  echo
  export "$var_name=$value"
}

prompt_value() {
  local var_name="$1"
  local label="$2"
  local value=""
  read -r -p "$label: " value
  export "$var_name=$value"
}

echo "Enter Stripe values (input is hidden for secrets)."
prompt_secret "STRIPE_SECRET_KEY" "STRIPE_SECRET_KEY"
prompt_secret "STRIPE_WEBHOOK_SECRET" "STRIPE_WEBHOOK_SECRET"

prompt_value "STRIPE_PRICE_ID_PERSONAL_MONTHLY" "STRIPE_PRICE_ID_PERSONAL_MONTHLY"
prompt_value "STRIPE_PRICE_ID_PERSONAL_YEARLY" "STRIPE_PRICE_ID_PERSONAL_YEARLY"
prompt_value "STRIPE_PRICE_ID_PRACTITIONER_MONTHLY" "STRIPE_PRICE_ID_PRACTITIONER_MONTHLY"
prompt_value "STRIPE_PRICE_ID_PRACTITIONER_YEARLY" "STRIPE_PRICE_ID_PRACTITIONER_YEARLY"

# Backward-compatible fallbacks for legacy code paths
export STRIPE_PRICE_ID="${STRIPE_PRICE_ID_PERSONAL_MONTHLY}"
export STRIPE_PRICE_ID_PERSONAL="${STRIPE_PRICE_ID_PERSONAL_MONTHLY}"
export STRIPE_PRICE_ID_PRACTITIONER="${STRIPE_PRICE_ID_PRACTITIONER_MONTHLY}"

echo
printf 'Exported vars in current shell:\n'
echo "- STRIPE_SECRET_KEY (len=${#STRIPE_SECRET_KEY})"
echo "- STRIPE_WEBHOOK_SECRET (len=${#STRIPE_WEBHOOK_SECRET})"
echo "- STRIPE_PRICE_ID_PERSONAL_MONTHLY=${STRIPE_PRICE_ID_PERSONAL_MONTHLY}"
echo "- STRIPE_PRICE_ID_PERSONAL_YEARLY=${STRIPE_PRICE_ID_PERSONAL_YEARLY}"
echo "- STRIPE_PRICE_ID_PRACTITIONER_MONTHLY=${STRIPE_PRICE_ID_PRACTITIONER_MONTHLY}"
echo "- STRIPE_PRICE_ID_PRACTITIONER_YEARLY=${STRIPE_PRICE_ID_PRACTITIONER_YEARLY}"

echo
echo "Tip: to persist for deploy tooling, append to backend/.env.production manually (do not commit secrets)."