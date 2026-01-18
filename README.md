# Shape Theory

Discover your entertainment shape — a dimensional profile that transcends genre boundaries.

## Quick Start

### 1. Get the code on your machine

```bash
git clone https://github.com/ChrisArnell/ShapeTheory.git
cd ShapeTheory
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

Copy `.env.example` to `.env.local` and add your keys:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `ANTHROPIC_API_KEY` - Your Anthropic API key (get one at console.anthropic.com)

### 4. Set up database

1. Go to your Supabase project → SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Run it

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Connect repo in Vercel
3. Add environment variables in Vercel project settings
4. Deploy

## How It Works

1. **Shape Capture**: List your favorites across any media. Claude analyzes dimensional patterns.

2. **Dimensional Profile**: Instead of "you like comedy," you get: darkness 8/10, intellectual engagement 9/10, pandering tolerance 2/10.

3. **Shape-Based Recommendations**: "Patriot (Amazon) - darkness 9, emotional directness 8, absurdism 7. 95% shape match."

4. **Learning Loop**: Rate recommendations → refine your shape → better predictions → track what actually works.

## The Dimensions

- **Darkness**: Tolerance for dark themes, moral ambiguity, tragedy
- **Intellectual Engagement**: Need for complexity and thinking
- **Sentimentality**: Appreciation for emotional manipulation
- **Absurdism**: Enjoyment of surreal/nonsensical
- **Craft Obsession**: Appreciation for technical excellence
- **Pandering Tolerance**: Tolerance for obvious audience-pleasing
- **Emotional Directness**: Preference for explicit vs subtle emotion
- **Vulnerability Appreciation**: Value on authentic vulnerability
- **Novelty Seeking**: Preference for experimental vs familiar
- **Working Class Authenticity**: Appreciation for blue-collar perspectives

## Tech Stack

- Next.js 14 (App Router)
- Supabase (Postgres + Auth)
- Anthropic Claude API
- Tailwind CSS
- Vercel (hosting)

## License

MIT
