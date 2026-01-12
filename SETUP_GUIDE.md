# Real-Time Application Setup Guide

This guide provides step-by-step instructions to set up the Meta Command Center application for real-time messaging with WhatsApp and Instagram.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Meta Developer Account Setup](#meta-developer-account-setup)
3. [Local Environment Configuration](#local-environment-configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Webhook Configuration (Crucial for Real-Time)](#webhook-configuration)
7. [Verification & Testing](#verification--testing)

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

*   **Node.js** (v18 or higher recommended)
*   **PostgreSQL** (running locally or accessible via URL)
*   **Redis** (optional, but recommended for production-grade caching)
*   **Ngrok** (REQUIRED for local webhook testing) - [Download here](https://ngrok.com/download)

---

## 2. Meta Developer Account Setup

You need a Meta (Facebook) Developer account to access the WhatsApp Cloud API.

1.  **Create an Account**: Go to [developers.facebook.com](https://developers.facebook.com/) and sign up.
2.  **Create an App**:
    *   Click **My Apps** -> **Create App**.
    *   Select **Other** -> **Next**.
    *   Select **Business** -> **Next**.
    *   Enter an **App Name** (e.g., "Command Center Dev") and contact email.
    *   Click **Create App**.
3.  **Add WhatsApp Product**:
    *   On the App Dashboard, scroll down to find **WhatsApp**.
    *   Click **Set up**.
    *   Select a **Meta Business Account** (or create a new one).
4.  **Get Credentials**:
    *   Go to **WhatsApp** -> **API Setup** in the left sidebar.
    *   **Temporary Access Token**: Copy this for initial testing (expires in 24 hours). 
    

    *   **Phone Number ID**: Copy the "Phone number ID" (e.g., `123456789...`). 342847945577237
    *   **WhatsApp Business Account ID**: Copy this ID. 371478462705530
5.  **Get App Secret**:
    *   Go to **App settings** -> **Basic**.
    *   Click **Show** next to **App Secret**. Copy this value.  

---

## 3. Local Environment Configuration

1.  **Clone/Open the Project**: Ensure you are in the project root directory.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    *   Open the `.env` file in the root directory.
    *   Update the following values with your credentials:

    ```env
    # Server Configuration
    PORT=3000
    NODE_ENV=development

    # Database
    DATABASE_URL=postgresql://postgres:password@localhost:5432/meta_command_center

    # Security
    # Generate a random string for JWT (e.g., use `openssl rand -hex 32`)
    JWT_SECRET=your_secure_random_jwt_secret
    
    # Meta / WhatsApp Configuration
    # From App Settings -> Basic -> App Secret
    META_APP_SECRET=your_meta_app_secret_here
    
    # From WhatsApp -> API Setup -> Temporary Access Token (or System User Token)
    WHATSAPP_TOKEN=your_whatsapp_access_token_here
    
    # Arbitrary string you create (e.g., "my_secure_webhook_token")
    # You will paste this into the Meta Dashboard later
    WHATSAPP_VERIFY_TOKEN=my_secure_webhook_token
    ```

---

## 4. Database Setup

1.  **Create the Database**:
    *   Open your terminal or a Postgres tool (like pgAdmin or TablePlus).
    *   Create a database named `meta_command_center` (or whatever matches your `DATABASE_URL`).
    ```bash
    createdb meta_command_center
    ```

2.  **Run Migrations**:
    *   The project uses SQL files in `db/migrations`.
    *   You can execute them using `psql`:
    ```bash
    psql -d meta_command_center -f db/migrations/0001_meta_command_center.sql
    ```

3.  **Seed Data (Optional)**:
    *   Populate the DB with test data:
    ```bash
    psql -d meta_command_center -f db/seeds/001_demo_data.sql
    ```
    *   **Or use the script**:
    ```bash
    node scripts/seed_instagram.js
    ```

---

## 5. Running the Application

1.  **Start the Server**:
    ```bash
    npm run dev
    ```
    *   You should see: `[server] Listening on port 3000`.

2.  **Start Ngrok (Crucial Step)**:
    *   Since Meta cannot reach `localhost:3000`, you need a public tunnel.
    *   Open a **new terminal** window.
    *   Run:
    ```bash
    ngrok http 3000
    ```
    *   Copy the **Forwarding URL** (e.g., `https://a1b2-c3d4.ngrok-free.app`). **Note**: Use the `https` version.

---

## 6. Webhook Configuration

This connects Meta's real-time events to your local app.

1.  **Go to Meta Dashboard**:
    *   Navigate to **WhatsApp** -> **Configuration**.
2.  **Edit Webhook**:
    *   Click **Edit** next to "Webhook".
    *   **Callback URL**: Paste your Ngrok URL followed by `/webhooks/whatsapp`.
        *   Example: `https://a1b2-c3d4.ngrok-free.app/webhooks/whatsapp`
    *   **Verify Token**: Enter the exact string you put in your `.env` file for `WHATSAPP_VERIFY_TOKEN` (e.g., `my_secure_webhook_token`).
    *   Click **Verify and Save**.
        *   *Troubleshooting*: If this fails, check your terminal running `npm run dev`. It should log a request. Ensure `WHATSAPP_VERIFY_TOKEN` matches exactly.
3.  **Manage Webhook Fields**:
    *   Click **Manage** under "Webhook fields".
    *   Find **messages** and click **Subscribe**.
    *   (Optional) Subscribe to `message_template_status_update` for template approvals.

---

## 7. Verification & Testing

1.  **Send a Test Message**:
    *   Go to **WhatsApp** -> **API Setup**.
    *   Scroll to "Send and receive messages".
    *   In the "To" field, enter your personal WhatsApp number (you must add it as a recipient first).
    *   Click **Send Message**.
2.  **Check Your App**:
    *   Look at the terminal running `npm run dev`. You should see logs indicating a message was received.
    *   Open the app in your browser (`http://localhost:3000`).
    *   Go to the **Inbox**. You should see the test message appear in real-time!

3.  **Reply from Phone**:
    *   Reply to the test message from your actual WhatsApp on your phone.
    *   The message should appear in your Inbox UI instantly.

---

## 8. Instagram Setup (Optional)

1.  **Add Instagram Product**: In Meta Dashboard, add "Instagram Graph API".
2.  **Configure Webhook**: Similar to WhatsApp, but under "Instagram" -> "Basic Display" or "Graph API".
3.  **Update .env**: You may need separate tokens if using different System Users, or reuse the same if the System User has permissions for both assets.

---

### **Troubleshooting Common Issues**

*   **Webhook Verification Failed**:
    *   Is Ngrok running?
    *   Did you save the `.env` file and restart the server?
    *   Does the `WHATSAPP_VERIFY_TOKEN` match exactly?
*   **Messages Not Appearing**:
    *   Check `server.log` or terminal output.
    *   Ensure the `messages` webhook field is **Subscribed** in Meta Dashboard.
    *   Ensure your test phone number is added to the "To" list in API Setup (for development mode apps).
