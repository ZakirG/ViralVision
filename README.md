# ViralVision

**AI-Powered Content Optimization for Short-Form Video Creators**

ViralVision is a smart writing platform designed specifically for short-form video creators on TikTok, Instagram Reels, and YouTube Shorts. It combines AI with real-time editing tools to help creators write, optimize, and perfect their video scripts for maximum engagement and virality.

## 🚀 Features

### 🤖 AI-Powered Content Optimization
- **Viral Script Analysis**: AI critiques your content and suggests improvements to increase engagement
- **Smart Rewriting**: GPT-4.1-mini powered rewrites that maintain your voice while optimizing for virality
- **Content Goals**: Set your content type (Education, Edutainment, Storytime, Ad) and target audience level

### ✍️ Advanced Text Editor
- **Real-time Grammar Check**: Powered by LanguageTool API and write-good library
- **Smart Spell Check**: Context-aware spelling corrections with intelligent word completion detection
- **Rich Text Formatting**: Bold, italic, underline, and list formatting with keyboard shortcuts
- **Suggestion Highlighting**: Visual indicators for grammar, spelling, and style improvements

### 📱 TikTok Integration
- **Video Import**: Extract transcripts from TikTok videos for optimization
- **Content Analysis**: Analyze successful content patterns from imported videos
- **Transcript Cleaning**: AI-powered transcript cleaning and formatting

### 📊 Content Management
- **Document Organization**: Save, organize, and manage multiple video scripts
- **Version History**: Track changes and revisions to your content
- **Performance Tracking**: Analytics integration for content performance monitoring

### 🎯 Creator-Focused Tools
- **Viral Hooks Generator**: Create attention-grabbing opening lines
- **Engagement Optimization**: Suggestions for maintaining viewer attention
- **Call-to-Action Optimization**: Improve your CTAs for better conversion

## 🛠 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with modern features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Modern component library
- **Framer Motion** - Smooth animations and transitions
- **Slate.js** - Rich text editing framework

### Backend
- **Next.js Server Actions** - Server-side logic
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe database operations
- **Supabase** - Database hosting and real-time features

### AI & APIs
- **OpenAI GPT-4** - Content analysis and rewriting
- **LanguageTool API** - Grammar and spell checking
- **write-good** - Writing style analysis
- **OpenRouter** - Alternative AI provider (fallback)

### Authentication & Payments
- **Clerk** - User authentication and management
- **Stripe** - Payment processing and subscriptions

### Analytics & Monitoring
- **PostHog** - Product analytics and user tracking
- **Vercel Analytics** - Performance monitoring

### Development & Deployment
- **Vercel** - Hosting and deployment
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🏃‍♂️ Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- PostgreSQL database (local or hosted)
- OpenAI API key
- Clerk account for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/viralvision.git
   cd viralvision
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/viralvision"
   
   # Authentication (Clerk)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   
   # AI Services
   OPENAI_API_KEY="sk-..."
   OPENROUTER_API_KEY="sk-or-..." # Optional fallback
   
   # Payments (Stripe)
   STRIPE_SECRET_KEY="sk_test_..."
   
   # Analytics (PostHog)
   NEXT_PUBLIC_POSTHOG_KEY="phc_..."
   NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
   
   # App Configuration
   NEXT_PUBLIC_APP_URL="http://localhost:3007"
   ```

4. **Set up the database**
   
   Run database migrations:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:3007`

### Quick Setup with Supabase

1. Create a new project on [Supabase](https://supabase.com)
2. Get your database URL from the project settings
3. Update the `DATABASE_URL` in your `.env.local`
4. Run the database migrations as shown above

### Authentication Setup (Clerk)

1. Create an account at [Clerk](https://clerk.com)
2. Create a new application
3. Copy the publishable and secret keys to your `.env.local`
4. Configure your sign-in/sign-up flow in the Clerk dashboard

## 🚀 Scripts

- `npm run dev` - Start development server on port 3007
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run test` - Run the test suite
- `npm run lint` - Lint the codebase
- `npm run format:write` - Format code with Prettier
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations

## 📁 Project Structure

```
ViralVision/
├── actions/                 # Server actions
│   ├── db/                 # Database operations
│   ├── analytics-actions.ts
│   ├── openai-*.ts         # AI-powered actions
│   └── languagetool-*.ts   # Grammar/spell check
├── app/                    # Next.js app directory
│   ├── api/                # API routes
│   ├── dashboard/          # Dashboard pages
│   ├── editor/             # Main editor interface
│   └── layout.tsx
├── components/             # Shared components
│   ├── ui/                 # Shadcn UI components
│   └── utilities/          # Utility components
├── db/                     # Database configuration
│   ├── schema/             # Database schemas
│   └── db.ts              # Database client
├── lib/                    # Library utilities
├── types/                  # TypeScript type definitions
└── workers/               # Web workers for performance
```

## 🔧 Configuration

### Editor Features

The editor supports several intelligent features that can be configured:

- **Grammar Check Triggers**: Sentence completion (period, exclamation, question mark) and Enter key
- **Spell Check Triggers**: Word completion (space, punctuation after letters)
- **AI Critique**: Triggered manually or on content changes
- **Debounce Delays**: 800ms for spell check, configurable for grammar check

### Content Types

ViralVision supports four main content types:
- **Education**: Teaching-focused content
- **Edutainment**: Educational content that entertains
- **Storytime**: Narrative-driven content
- **Ad**: Promotional and advertising content

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/your-username/viralvision/issues) page
2. Create a new issue with detailed information
3. Contact support at support@viralvision.com

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT-4 API
- [LanguageTool](https://languagetool.org) for grammar checking
- [Clerk](https://clerk.com) for authentication
- [Supabase](https://supabase.com) for database hosting
- [Vercel](https://vercel.com) for deployment platform