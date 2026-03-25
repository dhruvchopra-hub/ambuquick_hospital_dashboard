# AmbuQuick Hospital Partner Dashboard

A full-stack hospital management dashboard for AmbuQuick ambulance services. Built with Next.js 14, Supabase, and Tailwind CSS.

---

## What This App Does

This is a web dashboard for hospital administrators to:
- See live ambulance fleet status
- Book ambulances for patients
- Track ambulances on a live map
- View all ride history with filters
- Manage their fleet of vehicles
- View and download PDF invoices
- Analyse performance with charts

---

## Complete Setup Guide (Non-Technical)

Follow these steps exactly, in order. Each step is simple.

---

### PART 1 — Set Up Supabase (your database)

**Step 1.1 — Create a free Supabase account**

1. Open your browser and go to: https://supabase.com
2. Click **"Start your project"** (top right)
3. Sign up with your Google account or email
4. Once logged in, click **"New project"**

**Step 1.2 — Create a new project**

1. Enter a name: `ambuquick-dashboard`
2. Enter a database password (save this somewhere safe — you don't need it often)
3. Select region: **South Asia (Mumbai)** — closest to India
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to set up (you'll see a loading screen)

**Step 1.3 — Get your API keys**

1. In your Supabase project, click **"Settings"** in the left sidebar (gear icon)
2. Click **"API"**
3. You'll see two values — copy both:
   - **Project URL** — looks like: `https://abcdefghijkl.supabase.co`
   - **anon public key** — a long string of letters and numbers

**Step 1.4 — Run the database schema**

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from this project folder
4. Copy ALL of its contents
5. Paste it into the SQL Editor
6. Click the green **"Run"** button
7. You should see "Success. No rows returned" — this means it worked!

**Step 1.5 — Create your demo login account**

1. In Supabase, click **"Authentication"** in the left sidebar
2. Click **"Users"**
3. Click **"Add user"** → **"Create new user"**
4. Enter:
   - Email: `demo@ujala.com`
   - Password: `demo123`
5. Click **"Create user"**
6. The trigger we set up will automatically link this account to Ujala Cygnus Hospital ✓

> **Note:** If you want to use your own email instead, go to `supabase/schema.sql`, find the hospitals insert, and change `'demo@ujala.com'` to your email before running the SQL. Then create your Supabase Auth user with that same email.

---

### PART 2 — Set Up Google Maps (for live tracking)

> **Skip this if you don't need maps right now** — the app works without it, the tracking page will show a placeholder.

**Step 2.1 — Get a Google Maps API key**

1. Go to: https://console.cloud.google.com
2. Sign in with your Google account
3. Create a new project (top bar → click project name → "New Project")
4. Name it `ambuquick` and click "Create"
5. Click **"APIs & Services"** → **"Enable APIs and Services"**
6. Search for **"Maps JavaScript API"** and enable it
7. Go to **"APIs & Services"** → **"Credentials"**
8. Click **"+ Create Credentials"** → **"API Key"**
9. Copy the API key shown

---

### PART 3 — Set Up the App on Your Computer

**Step 3.1 — Install Node.js** (if not already installed)

1. Go to: https://nodejs.org
2. Download the **LTS version** (recommended)
3. Install it (just click Next, Next, Install)
4. Open Terminal (Mac: press Cmd+Space, type "Terminal", press Enter)
5. Type: `node --version` and press Enter — you should see a version number like `v20.x.x`

**Step 3.2 — Open the project folder in Terminal**

On Mac:
1. Open Terminal
2. Type: `cd ` (with a space after cd)
3. Drag the `ambuquick-hospital-dashboard` folder from Finder into the Terminal window
4. Press Enter

On Windows:
1. Open the `ambuquick-hospital-dashboard` folder in File Explorer
2. Right-click inside the folder → "Open in Terminal" or "Open PowerShell here"

**Step 3.3 — Set up your environment variables**

1. In the project folder, find the file called `.env.local`
2. Open it with any text editor (Notepad, TextEdit, VS Code)
3. Replace the placeholder values with your real keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key-here
```

4. Save the file

**Step 3.4 — Install dependencies**

In Terminal, type:
```
npm install
```
Wait for it to finish (may take 2-3 minutes on first run).

**Step 3.5 — Start the app**

```
npm run dev
```

You should see:
```
▲ Next.js 14.2.5
- Local: http://localhost:3000
```

**Step 3.6 — Open the app**

Open your browser and go to: http://localhost:3000

You'll see the login page. Sign in with:
- Email: `demo@ujala.com`
- Password: `demo123`

You should now see the full dashboard with all demo data!

---

### PART 4 — Deploy to Vercel (make it live on the internet)

**Step 4.1 — Push your code to GitHub**

1. Go to: https://github.com and create a free account if you don't have one
2. Click **"New repository"** (the + button top right)
3. Name it `ambuquick-hospital-dashboard`
4. Keep it Private, click **"Create repository"**
5. Follow GitHub's instructions to push your code (they show exact commands)

**Step 4.2 — Deploy on Vercel**

1. Go to: https://vercel.com
2. Sign up / Sign in with your GitHub account
3. Click **"Add New Project"**
4. Import your `ambuquick-hospital-dashboard` repository
5. Vercel will auto-detect it's a Next.js app

**Step 4.3 — Add environment variables in Vercel**

Before clicking "Deploy":
1. Scroll down to **"Environment Variables"**
2. Add each variable:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = your Google Maps key
3. Click **"Deploy"**

**Step 4.4 — Your app is live!**

Vercel will give you a URL like: `https://ambuquick-hospital-dashboard.vercel.app`

Share this URL with hospital staff!

> **Google Maps on production:** In Google Cloud Console, add your Vercel domain to the "HTTP referrers" restriction on your API key to secure it.

---

## App Pages

| Page | URL | Description |
|------|-----|-------------|
| Login | `/login` | Email + password login |
| Overview | `/` | Live stats, recent activity, fleet status |
| Book Ambulance | `/book` | Dispatch form with confirmation |
| Live Tracking | `/tracking` | Google Maps with real-time positions |
| Ride History | `/history` | All rides table, CSV export |
| Fleet Manager | `/fleet` | View/manage all vehicles |
| Invoices | `/invoices` | View, create, download PDF invoices |
| Analytics | `/analytics` | Charts and performance metrics |

---

## Demo Login Credentials

| Field | Value |
|-------|-------|
| Email | demo@ujala.com |
| Password | demo123 |
| Hospital | Ujala Cygnus Hospital, New Delhi |

---

## Adding a New Hospital

To add a second hospital (e.g., for a different hospital partner):

1. In Supabase SQL Editor, run:
```sql
INSERT INTO hospitals (name, contact_person, email, city, partner_since)
VALUES ('New Hospital Name', 'Contact Person', 'admin@newhospital.com', 'Mumbai', '2024-01-01');
```

2. Create a Supabase Auth user with email `admin@newhospital.com`
3. The trigger automatically links them to their hospital

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 14 (App Router) | Frontend framework |
| Supabase | Database, Auth, Realtime |
| Tailwind CSS | Styling |
| Google Maps API | Live tracking map |
| Recharts | Analytics charts |
| jsPDF + autoTable | PDF invoice generation |
| TypeScript | Type safety |
| Vercel | Hosting |

---

## Project Structure

```
ambuquick-hospital-dashboard/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # All dashboard pages
│   │   ├── layout.tsx         # Dashboard wrapper with sidebar
│   │   ├── page.tsx           # Overview
│   │   ├── book/              # Book ambulance
│   │   ├── tracking/          # Live tracking
│   │   ├── history/           # Ride history
│   │   ├── fleet/             # Fleet manager
│   │   ├── invoices/          # Invoices
│   │   └── analytics/         # Analytics
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── components/
│   └── Sidebar.tsx            # Navigation sidebar
├── lib/supabase/
│   ├── client.ts              # Browser Supabase client
│   └── server.ts              # Server Supabase client
├── types/index.ts             # TypeScript types
├── supabase/schema.sql        # Database schema + seed data
├── middleware.ts              # Auth middleware
└── .env.local                 # Environment variables (your keys)
```

---

## Troubleshooting

**"Invalid login credentials" error**
→ Make sure you created the user in Supabase Authentication with exact email `demo@ujala.com`

**Dashboard shows no data**
→ The auto-link trigger may not have fired. In Supabase SQL Editor, run:
```sql
INSERT INTO user_profiles (user_id, hospital_id)
SELECT u.id, 'aaaaaaaa-0000-0000-0000-000000000001'
FROM auth.users u
WHERE u.email = 'demo@ujala.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Google Maps not showing**
→ Check your API key in `.env.local`. Make sure the Maps JavaScript API is enabled in Google Cloud Console.

**npm install fails**
→ Make sure Node.js is installed. Run `node --version` to check. Need version 18 or higher.

**Build fails on Vercel**
→ Double-check all three environment variables are set in Vercel project settings.

---

## Support

Built for AmbuQuick by the tech team.
For questions: engineering@ambuquick.in
# ambuquick_hospital_dashboard
