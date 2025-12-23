# Votabase Admin Dashboard

This is a Next.js admin dashboard application for managing tenants, users, and reports.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_BASE_URL=http://localhost:8080
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm start` - Start the production server (after building)
- `npm run lint` - Run ESLint

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── components/         # Reusable components
│   ├── dashboard/          # Dashboard page
│   ├── tenants/            # Tenants management page
│   ├── reports/            # Reports page
│   ├── login/              # Login page
│   ├── layout.js           # Root layout
│   ├── page.js             # Home page (redirects)
│   └── globals.css         # Global styles
├── public/                 # Static assets
├── middleware.js           # Authentication middleware
└── next.config.js          # Next.js configuration
```

## Features

- Authentication with JWT tokens
- Protected routes using Next.js middleware
- Material-UI components
- Tenant management with CRUD operations
- Responsive sidebar navigation
- Role-based access control

## Environment Variables

- `NEXT_PUBLIC_BASE_URL` - Base URL for the API backend

## Deployment

Build the application:
```bash
npm run build
npm start
```

For production deployment, consider using platforms like Vercel, Netlify, or your own server with Node.js.
