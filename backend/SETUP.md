# Manual setup (Google Cloud + Supabase)

These steps require clicking through consoles and cannot be automated. Complete them before running the backend.

## 1. Google Cloud project and APIs

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or select an existing one).
2. Enable these APIs for the project:
   - Gmail API
   - Google Calendar API
   - Google Docs API
   - Google Sheets API
   - Google Drive API

You can enable them via **APIs & Services → Library**, searching for each name.

## 2. OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** as the user type.
3. Fill in the required app information (app name, support email, developer contact).
4. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/documents`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
   - `openid`
   - `email`
   - `profile`
5. While the app is in **Testing** mode, add your own email address as a **test user**. This is required until Google’s verification process (described in the design doc) is complete.

## 3. OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**.
2. Create credentials → **OAuth client ID**.
3. Application type: **Web application**.
4. Under **Authorized redirect URIs**, add exactly:

   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```

   Replace `<your-supabase-project-ref>` with your Supabase project reference (visible in the Supabase project URL).
5. Copy the generated **Client ID** and **Client Secret**. You will paste them into Supabase in the next step, and also into this backend’s `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## 4. Supabase Google provider

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication → Providers → Google**.
3. Enable the Google provider.
4. Paste the Google **Client ID** and **Client Secret** from step 3.
5. Save.

## 5. Supabase API keys

1. Go to **Project Settings → API**.
2. Copy the following values for environment variables:
   - **Project URL** → `SUPABASE_URL` (and frontend `VITE_SUPABASE_URL`)
   - **anon public** key → frontend `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend only — never expose to the browser)
   - **JWT Secret** → `SUPABASE_JWT_SECRET` (under JWT Settings)

## 6. Run the database migration

1. In the Supabase Dashboard, open **SQL Editor**.
2. Paste and run the contents of [`migrations/001_initial.sql`](migrations/001_initial.sql) from this repository.
3. Confirm the tables `google_tokens`, `agent_settings`, `conversations`, `messages`, and `activity_log` exist and RLS is enabled.
