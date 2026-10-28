# VMeet Admin Dashboard

A Next.js admin panel for the VMeet application. This application provides administrative access to manage users, sessions, and attendance records.

## Features

- Admin login page with authentication
- Dashboard view
- Responsive design
- Integration with VMeet backend API

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd admin
npm install
```

### Running the Application

**Development:**
```bash
npm run dev
```

The admin dashboard will be available at `http://localhost:3001`

**Production:**
```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file in the admin directory:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Replace `http://localhost:8000` with your actual backend API URL.

## Creating Admin Accounts

See the `scripts/create-admin.py` script to create new admin accounts.

## Project Structure

```
admin/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Login page
│   ├── globals.css         # Global styles
│   └── dashboard/
│       └── page.tsx        # Dashboard page
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
