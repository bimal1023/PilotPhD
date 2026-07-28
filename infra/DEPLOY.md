# Deploy runbook — whole stack on a single EC2 box

Everything runs on **one** instance via `docker-compose.prod.yml`: **Postgres**
(self-hosted — no RDS bill), **backend**, **frontend**, and **Caddy** for
automatic HTTPS.

- `pilotphd.com` / `www.pilotphd.com` → frontend · `api.pilotphd.com` → backend
- Region: `us-east-2` · instance type: `t4g.medium` (2 vCPU / 4 GB, ARM)
- App dir on box: `/opt/pilotphd/app` · prod env: `/opt/pilotphd/app/infra/.env`
- Postgres data lives on a **separate EBS volume** mounted at `/mnt/data`, so it
  survives instance rebuilds. The root volume does not.

Fill in as you go: instance ID `______` · Elastic IP `______`

## ⚠️ Rule #1: build ONE image at a time

Building the backend and frontend images simultaneously on a 4 GB box exhausts
memory and wedges it (low CPU, everything times out — it's swapping, not busy).
This has caused a production outage on arthvion. Always build sequentially:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
free -m   # wait for memory to settle
docker compose -f docker-compose.prod.yml up -d --build backend
```

---

## One-time setup

### 1. AWS resources

Security group needs inbound **22** (your IP only), **80**, and **443** (both
`0.0.0.0/0` — Caddy needs 80 for the ACME challenge). Postgres port 5432 is
**never** exposed; it's reachable only over the internal compose network.

```bash
# Key pair
aws ec2 create-key-pair --region us-east-2 --key-name pilotphd-key \
  --query KeyMaterial --output text > ~/.ssh/pilotphd-key.pem
chmod 400 ~/.ssh/pilotphd-key.pem

# Launch — Amazon Linux 2023, arm64, 30 GB root (two images + build cache)
aws ec2 run-instances --region us-east-2 \
  --image-id "$(aws ssm get-parameter --region us-east-2 \
    --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
    --query Parameter.Value --output text)" \
  --instance-type t4g.medium \
  --key-name pilotphd-key \
  --security-group-ids sg-XXXXXXXX \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=pilotphd}]'

# Elastic IP — without it the public IP changes on every stop/start and DNS breaks
aws ec2 allocate-address --region us-east-2
aws ec2 associate-address --region us-east-2 \
  --instance-id i-XXXXXXXX --allocation-id eipalloc-XXXXXXXX

# Data volume for Postgres (10 GB, same AZ as the instance)
aws ec2 create-volume --region us-east-2 --availability-zone us-east-2a \
  --size 10 --volume-type gp3 \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=pilotphd-data}]'
aws ec2 attach-volume --region us-east-2 \
  --volume-id vol-XXXXXXXX --instance-id i-XXXXXXXX --device /dev/sdf
```

### 2. DNS

At your registrar, three **A records**, all pointing at the Elastic IP:

| Name | Value |
|---|---|
| `@` (pilotphd.com) | Elastic IP |
| `www` | Elastic IP |
| `api` | Elastic IP |

If pilotphd.com currently points at Vercel, remove those records first. Verify
before continuing — Caddy's certificate request fails if DNS hasn't propagated:

```bash
dig +short pilotphd.com www.pilotphd.com api.pilotphd.com
```

### 3. Bootstrap the box

```bash
ssh -i ~/.ssh/pilotphd-key.pem ec2-user@<ELASTIC_IP>
```

```bash
# Docker + compose plugin (aarch64 build)
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 4 GB swap — the Next.js build is the memory-hungry step; this is the
# safety net behind Rule #1.
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Mount the data volume. Check lsblk for the real device name first —
# it is usually /dev/nvme1n1, NOT /dev/sdf.
lsblk
sudo mkfs -t xfs /dev/nvme1n1          # ONLY on a brand-new volume; this erases it
sudo mkdir -p /mnt/data
sudo mount /dev/nvme1n1 /mnt/data
echo "UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1) /mnt/data xfs defaults,nofail 0 2" \
  | sudo tee -a /etc/fstab

sudo mkdir -p /opt/pilotphd/app && sudo chown -R ec2-user:ec2-user /opt/pilotphd
exit   # log back in so the docker group applies
```

### 4. First deploy

```bash
# From your laptop, in the repo root — never syncs infra/.env
rsync -az --delete \
  --exclude='.git' --exclude='venv' --exclude='.venv' \
  --exclude='node_modules' --exclude='frontend/.next' \
  --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='infra/.env' --exclude='backend/.env' --exclude='frontend/.env.local' \
  -e "ssh -i ~/.ssh/pilotphd-key.pem" \
  ./ ec2-user@<ELASTIC_IP>:/opt/pilotphd/app/
```

On the box:

```bash
cd /opt/pilotphd/app/infra
cp .env.example .env
nano .env          # fill in every value; POSTGRES_PASSWORD must match DATABASE_URL

docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml up -d --build frontend   # slowest step
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml up -d caddy
docker compose -f docker-compose.prod.yml ps
```

The backend creates its own tables on startup (`init_db()` in
[backend/database.py](../backend/database.py)) — there is no migration step.

### 5. Decommission Vercel

Once `https://pilotphd.com` serves correctly, delete the Vercel project (or at
minimum remove its domain assignment) so it can't reclaim the DNS records.

Then drop the now-dead `allow_origin_regex` for `*.vercel.app` in
[backend/main.py](../backend/main.py) — it widens CORS to any host matching
`pilotphd*.vercel.app`, which anyone can register. Leave it until the cutover is
confirmed, since it's what keeps the old Vercel deployment working meanwhile.

---

## Redeploying code

```bash
# laptop — rsync as above, then ONE of these (never both in one command):
ssh -i ~/.ssh/pilotphd-key.pem ec2-user@<ELASTIC_IP> \
  "cd /opt/pilotphd/app/infra && docker compose -f docker-compose.prod.yml up -d --build frontend"

ssh -i ~/.ssh/pilotphd-key.pem ec2-user@<ELASTIC_IP> \
  "cd /opt/pilotphd/app/infra && docker compose -f docker-compose.prod.yml up -d --build backend"
```

Env-only change: edit `/opt/pilotphd/app/infra/.env` on the box, then
`docker compose -f docker-compose.prod.yml up -d backend` — no rebuild needed.

Reclaim disk after a few deploys: `docker image prune -f`.

## Health checks

```bash
curl https://api.pilotphd.com/health     # {"status":"ok"} — also proves Postgres is reachable
curl -I https://pilotphd.com/            # 200
curl -I https://api.pilotphd.com/docs    # 404 in production, by design
```

Logs: `docker compose -f docker-compose.prod.yml logs -f backend` (add `caddy`
to debug certificate issuance).

## Backups

Nothing backs the database up automatically. Either snapshot the EBS volume on a
schedule (AWS Backup / DLM), or dump nightly:

```bash
mkdir -p /mnt/data/backups
# crontab -e on the box
0 4 * * * docker exec pilotphd-postgres pg_dump -U postgres pilotphd | gzip > /mnt/data/backups/pilotphd-$(date +\%F).sql.gz
```

Prune old files so the volume doesn't fill.

## Troubleshooting

**Caddy won't get a certificate** — DNS not pointing at the Elastic IP yet, or
port 80 closed in the security group. `docker compose logs caddy`. Let's Encrypt
rate-limits repeated failures, so fix DNS before retrying.

**Frontend loads but every API call fails** — `NEXT_PUBLIC_API_URL` is inlined at
build time, so changing it requires `--build frontend`, not a restart.

**CORS errors** — the origin must be listed in `FRONTEND_URL` (comma-separated).

**Logged in, then 401s** — confirm `ENVIRONMENT=production` in `infra/.env` and
that you're on `https://`. Cookies are `Secure` in production and won't be sent
over plain HTTP.

**Box unresponsive, low CPU** — memory exhaustion. Elastic IP and data volume
survive a force power-cycle:

```bash
aws ec2 stop-instances  --region us-east-2 --instance-ids i-XXXXXXXX --force
aws ec2 wait instance-stopped --region us-east-2 --instance-ids i-XXXXXXXX
aws ec2 start-instances --region us-east-2 --instance-ids i-XXXXXXXX
```

Containers come back on their own (`restart: unless-stopped`).
