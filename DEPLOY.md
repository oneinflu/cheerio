# Deployment Guide for Digital Ocean

This guide covers two methods to deploy the application on Digital Ocean:
1.  **App Platform (Recommended)**: The easiest, scalable, and managed approach.
2.  **Droplet (Docker Compose)**: For full control and lower cost on a single server.

---

## Method 1: Digital Ocean App Platform (Recommended)

App Platform connects to your GitHub repository and automatically builds/deploys your app.

### 1. Push Code to GitHub
Ensure your latest code (including the `Dockerfile` in the root) is pushed to your GitHub repository.

### 2. Create App in Digital Ocean
1.  Log in to [Digital Ocean Cloud Console](https://cloud.digitalocean.com/).
2.  Click **Create** -> **Apps**.
3.  **Choose Source**: Select **GitHub**.
4.  Select your **Repository** and **Branch** (e.g., `main`).
5.  **Source Directory**: Leave as `/` (default).
6.  Click **Next**.

### 3. Configure Resources
Digital Ocean will detect the `Dockerfile`.
1.  **Resource Type**: Web Service.
2.  **Name**: `meta-command-center` (or similar).
3.  **HTTP Port**: Ensure it is set to `3000`.
4.  **Database**: Click **Add Database**.
    *   Select **Dev Database** (PostgreSQL) for testing ($7/mo) or **Managed Database** for production.
    *   Name it `db`.
    *   *Note: App Platform automatically injects `DATABASE_URL` environment variable.*
5.  **(Optional) Redis**: Click **Add Database** -> **Redis**.
    *   This is recommended for real-time socket performance.
    *   If skipped, sockets will work but won't scale across multiple instances.

### 4. Configure Environment Variables
Click **Edit** next to "Environment Variables" and add:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (A long random string) |
| `META_APP_SECRET` | (From Meta App Dashboard) |
| `WHATSAPP_TOKEN` | (Your System User Token) |
| `WHATSAPP_VERIFY_TOKEN` | (Your chosen webhook token) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | (Your Business ID) |
| `REDIS_URL` | `${db-redis.REDIS_URL}` (If you added Redis) |

*Note: `DATABASE_URL` and `PORT` are handled automatically.*

### 5. Review & Launch
1.  Select a plan (Basic or Pro).
2.  Click **Create Resources**.
3.  Wait for the build to complete. You will get a live URL (e.g., `https://meta-command-center-xyz.ondigitalocean.app`).

### 6. Post-Deployment
1.  Go to your **Meta App Dashboard** -> **WhatsApp** -> **Configuration**.
2.  **Callback URL**: Enter your new app URL + `/webhooks/whatsapp` (e.g., `https://.../webhooks/whatsapp`).
3.  **Verify Token**: Enter the `WHATSAPP_VERIFY_TOKEN` you set in step 4.
4.  Verify and Save.

---

## Method 2: Droplet (Docker Compose)

Use this method if you want a simple Linux server (VPS).

### 1. Create a Droplet
1.  Create a Droplet (Ubuntu 22.04 or 24.04).
2.  Choose size (e.g., Basic, 2GB RAM recommended for build).
3.  Add your SSH Key.

### 2. Prepare the Server
SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Install Docker & Docker Compose:
```bash
# Update and install Docker
sudo apt update
sudo apt install -y docker.io docker-compose

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 3. Deploy Code
Clone your repository (or copy files):
```bash
git clone https://github.com/your-username/your-repo.git app
cd app
```

### 4. Configure Environment
Create a `.env` file (Docker Compose will read this):
```bash
nano .env
```

Paste your secrets:
```env
META_APP_SECRET=...
WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
```

### 5. Start the Application
```bash
# Build and run in background
docker-compose up -d --build
```

### 6. Access & SSL
1.  Your app is now running on `http://your_droplet_ip:3000`.
2.  **Important**: WhatsApp Webhooks require **HTTPS**.
    *   You must set up a domain (e.g., `chat.example.com`) pointing to your Droplet IP.
    *   Use **Nginx** and **Certbot** to handle SSL.

#### Quick Nginx + SSL Setup (Optional)
```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx Proxy
sudo nano /etc/nginx/sites-available/default
# (Replace contents to proxy port 80 -> 3000)

# Request Cert
sudo certbot --nginx -d chat.example.com
```

---

## Troubleshooting

*   **Database Migrations**: The application is configured to automatically run database migrations on startup (`server.js` -> `runMigrations()`). You don't need to manually migrate.
*   **Logs**:
    *   App Platform: Go to the **Runtime Logs** tab.
    *   Droplet: Run `docker-compose logs -f app`.
