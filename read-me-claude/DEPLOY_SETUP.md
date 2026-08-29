# Deploy Setup — GitHub Actions (PLT-2)

## How the workflow works

`.github/workflows/deploy.yml` runs on every push to `main` and can also be
triggered manually from GitHub → Actions → "Deploy to VPS" → "Run workflow".

It SSHes into the VPS, runs `git pull`, restarts PM2, then runs two health
checks that fail the workflow loudly if either fails:

| Check | Expected | Fail means |
|---|---|---|
| `GET /api/stats` | 200 | Server didn't start |
| `POST /api/agents/chat` (empty body) | 401 | Auth regressed (400 = unauthenticated request slips through) |

## One-time setup: generate a dedicated deploy keypair ON the VPS

SSH into the VPS and run:

```bash
ssh root@46.62.169.246

# Generate a key dedicated to CI deploy (no passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/github_deploy -N ""

# Authorize the public key for root login
cat /root/.ssh/github_deploy.pub >> /root/.ssh/authorized_keys

# Print the private key — you will paste this into GitHub next
cat /root/.ssh/github_deploy
```

## Add the private key as a GitHub Actions secret

1. Copy the entire output of `cat /root/.ssh/github_deploy` (including the
   `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines).
2. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret**.
4. Name: `VPS_SSH_KEY`
5. Value: paste the private key.
6. Click **Add secret**.

Until the secret exists, every push to `main` will trigger the workflow and
it will fail at the SSH step. This is acceptable and loud — the failure is
visible in the Actions tab and will not silently skip the deploy.

## Verifying the workflow runs

After adding the secret, push any commit to `main`. Go to GitHub → Actions
and watch the "Deploy to VPS" run. A green checkmark means both health checks
passed. A red X shows the exact failing step in the log.

## SSH action used

`appleboy/ssh-action` pinned to commit SHA
`f077be959571d7e338f5c5e67af2c6f72fc36e3c` (v1.2.2).
This is a well-maintained, widely-used action. Check for newer versions at
https://github.com/appleboy/ssh-action/releases before upgrading.
