# UA frontend release runbook

`ua.vitaloop.today` is the Ukrainian rendering of the shared `frontend` application. Make cabinet changes in this repository; do not develop from the standalone `vitaloop_ua` snapshot repository.

## One-time migration

Run the bootstrap once from a reviewed commit:

```bash
SSH_KEY=/path/to/ssh-key ./scripts/bootstrap-ua-atomic-releases.sh
```

It creates `frontend/current -> frontend/dist`, changes nginx to serve `current`, validates nginx, reloads it, and verifies the existing UA site. Content is unchanged during that migration. The prior nginx configuration is retained under `/root/vitaloop-release-backups/`.

## Release procedure

1. Start from a clean, reviewed commit in `softdabtech/vitaloop`.
2. Build and run the frontend checks locally.
3. Deploy the already-built artifact:

```bash
SSH_KEY=/path/to/ssh-key ./scripts/deploy-ua-frontend-dist.sh
```

The script creates `frontend/releases/<commit>-<timestamp>`, validates its UA pages, then switches `frontend/current` with an atomic rename. It does not edit nginx and does not overwrite the live release in place.

## Required checks

- Test the same cabinet journeys against `vitaloop.today` and `ua.vitaloop.today`.
- Check Ukrainian copy explicitly; host-based locale selection does not translate new strings automatically.
- The frontend API origin is `https://api.vitaloop.today` unless a reviewed environment change says otherwise.
