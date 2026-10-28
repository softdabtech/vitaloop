# Workspace and deployment conventions

## Canonical locations

| Purpose | Canonical location |
| --- | --- |
| Local source repository | `/Users/oleksii/Documents/VITALOOP/projects/vitaloop` on `main` |
| GitHub source of truth | `softdabtech/vitaloop:main` |
| Server source checkout | `/var/www/VITALOOP` on `main` |
| UA active frontend | `/var/www/UAVITALOOP/frontend/current` |
| UA immutable releases | `/var/www/UAVITALOOP/frontend/releases/<release-id>` |

`vitaloop_ua` is a historical deployment snapshot only. Do not use it for feature work or deployments.

## Development rule

All product, cabinet, API, UI/UX, and localization changes start in the canonical local source repository. Ukrainian content uses the same `frontend` application and is selected by `ua.vitaloop.today`; it is not a separate product repository.

## Deployment rule

1. Commit and push to `main`.
2. Build `frontend` locally; never build the frontend on the production server.
3. Run `scripts/deploy-ua-frontend-dist.sh` for a reviewed UA release.
4. The script stages a new immutable release, verifies it, switches `frontend/current` atomically, and restores the previous release if smoke checks fail.

Nginx config is versioned at `ops/nginx/ua.vitaloop.today.conf`. The production vhost must match that file. The `/api/v1/` location is legacy; the shared frontend API origin is `https://api.vitaloop.today`.

## Local worktrees

Use short-lived task worktrees only for isolated work. After a branch is merged, remove its worktree and return VS Code to the canonical local source repository on `main`.
