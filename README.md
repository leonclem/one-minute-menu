# QR Menu System

A mobile-first digital menu platform that transforms paper menus into QR code-accessible digital menus using AI-powered vision-LLM extraction.


## Features

- 📱 **Mobile-First Design**: Optimized for restaurant owners who manage everything on their phones
- 📸 **Photo to Menu**: AI-powered vision-LLM extracts menu items from photos automatically
- 🎨 **Brand Styling**: Automatic color extraction from brand images with professional themes
- 📱 **QR Code Generation**: Instant QR codes for customer access
- ⚡ **Performance Optimized**: <3s load times, <130KB initial payload
- ♿ **Accessibility**: WCAG 2.1 AA compliant
- 🔒 **Privacy-First**: Cookieless analytics, no PII collection

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI Extraction**: OpenAI GPT-4V for direct image-to-menu parsing
- **AI Image Generation**: Nano Banana
- **Hosting**: Vercel (serverless + edge)
- **Queue**: PostgreSQL LISTEN/NOTIFY

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Vercel account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd qr-menu-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# If .env.local.example exists
# cp .env.local.example .env.local

# Otherwise, use the provided env.example
cp env.example .env.local
# Edit .env.local with your credentials
```

### Security: API keys and rotation

- Never commit real API keys. Use `.env.local` locally and Vercel/Supabase project env vars in cloud.
- If a key is exposed, rotate it immediately and update restrictions (HTTP referrers, IPs, and API scopes) in the relevant provider (e.g., OpenAI, Supabase, Vercel).
- You can run `npm run scan:secrets` to catch obvious secrets before committing.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Required environment variables are documented in `.env.local`. Key services needed:

- **Supabase**: Database, authentication, file storage
- **Vercel**: Hosting and deployment
- **OpenAI**: GPT-4V API for menu extraction
- **Nano Banana**: AI food image generation

### AI Image Generation (Nano Banana / Gemini)

Server
- `NANO_BANANA_API_KEY` — required to enable image creation
- `AI_IMAGE_GENERATION_DISABLED` — if `true`, backend returns 503 for create requests (kill switch)
- Optional: `NANO_BANANA_BASE_URL` — override endpoint for testing

Client
- `NEXT_PUBLIC_AI_IMAGE_GENERATION_DISABLED` — if `true`, hides the “Create Photo” option (Upload Photo remains)

Defaults (applied server-side)
- Safety filter: `block_some`
- Person generation: `dont_allow`
- Aspect ratio: `1:1`
- Variations: `1` (max 4)

## Project Structure

```
src/
├── app/                 # Next.js 14 app directory
├── components/          # Reusable UI components
│   └── ui/             # Base UI components
├── lib/                # Utility libraries
├── types/              # TypeScript type definitions
└── styles/             # Global styles and design system
```

## Development Phases

### Phase 1: Foundation ✅
- [x] Next.js project setup with TypeScript
- [x] Tailwind CSS with design system
- [x] Supabase integration
- [x] Basic project structure

### Phase 2: Authentication & Database
- [ ] User authentication with magic links
- [ ] Database schema creation
- [ ] User profiles and plan limits

### Phase 3: Menu Management
- [ ] Menu CRUD operations
- [ ] Menu versioning system
- [ ] Mobile-optimized interface

### Phase 4: AI Extraction & Image Generation
- [ ] Image upload system
- [ ] Vision-LLM menu extraction
- [ ] AI image generation

### Phase 5: Publishing & QR Codes
- [ ] Public menu viewer
- [ ] QR code generation
- [ ] Mobile sharing integration

## Design System

The project uses a custom design system built on Tailwind CSS with:

- **CSS Custom Properties**: For runtime theming
- **Component Variants**: Consistent UI patterns
- **Mobile-First**: Touch-friendly interactions
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized for mobile networks

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint
```

## Deployment

The project is configured for deployment on Vercel:

```bash
# Deploy to Vercel
vercel --prod
```

## Performance Targets

- **Initial Load**: ≤130KB payload, ≤3s TTFP on 4G
- **AI Extraction Processing**: p50 ≤20s, p95 ≤60s
- **Menu Availability**: 99.9% uptime
- **Accessibility**: WCAG 2.1 AA compliance

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@qrmenusystem.com or create an issue in this repository.