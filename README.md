# GIEFA Dashboard

Graduate Investment and Emergency Fund Association Dashboard.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Production is deployed with Vercel, Supabase, Cloudflare DNS, and the `giefa.org` domain.

## Production Deployment

Use Vercel for the Next.js app and API routes. DreamHost remains the domain registrar, while Cloudflare manages DNS.

Required Vercel environment variables are listed in `.env.production.example`.

Important production settings:

- Set `NEXT_PUBLIC_SITE_URL=https://giefa.org` in Vercel.
- Keep `.env.local` out of GitHub.
- Add both apex and www URLs in Supabase Auth URL Configuration:
  - `https://giefa.org/auth/callback`
  - `https://giefa.org/reset-password`
  - `https://www.giefa.org/auth/callback`
  - `https://www.giefa.org/reset-password`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`

Future releases:

```bash
npm run lint
npm run build
git add .
git commit -m "Describe the update"
git push origin main
```

Vercel automatically builds and deploys the pushed `main` branch.
