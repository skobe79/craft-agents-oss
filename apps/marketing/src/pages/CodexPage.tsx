import { Link } from 'react-router-dom'
import agentsLogo from '../assets/agents_logo.svg'

export default function CodexPage() {
  return (
    <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 pt-[80px] pb-[128px]">
      {/* Logo with Codex badge */}
      <div className="flex flex-col items-center gap-3 mb-[48px]">
        <img src={agentsLogo} alt="Craft Agents" className="w-[224px]" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">with Codex</span>
          <span className="bg-[#6B3F9D] text-white text-[11px] font-semibold px-2 py-[3px] rounded-[6px] shadow-tinted uppercase tracking-wide">
            beta
          </span>
        </div>
      </div>

      {/* Hero header */}
      <div className="text-center max-w-xl py-2 mb-12">
        <h1 className="text-3xl font-extrabold leading-tight mb-4">
          Codex power. Craft control.
        </h1>
        <p className="text-[18px] text-foreground/70 leading-relaxed">
          Safe exploration, structured planning, and OpenAI's most capable coding model. In one beautiful app.
        </p>
      </div>

      {/* Download button */}
      <div className="flex flex-col items-center gap-3 mb-[60px]">
        <a
          href="https://agents.craft.do/codex-beta/Craft Agents.dmg"
          className="bg-foreground text-background rounded-[12px] shadow-strong py-3 px-6 text-center text-[14px] font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Download for Mac (Apple Silicon)
        </a>
        <p className="text-[13px] text-foreground/50">
          Currently available for Mac with Apple Silicon. More platforms coming soon.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mb-16">
        <div className="bg-background rounded-[12px] shadow-minimal p-6">
          <h3 className="font-semibold mb-2">Explore Mode</h3>
          <p className="text-[14px] text-foreground/70 leading-relaxed">
            Explore codebases risk-free. Read-only mode lets the AI understand your project without any chance of accidental modifications.
          </p>
        </div>
        <div className="bg-background rounded-[12px] shadow-minimal p-6">
          <h3 className="font-semibold mb-2">Plan → Approve → Execute</h3>
          <p className="text-[14px] text-foreground/70 leading-relaxed">
            Review before changes happen. Implementation plans require your approval. Clear gates prevent runaway modifications.
          </p>
        </div>
        <div className="bg-background rounded-[12px] shadow-minimal p-6">
          <h3 className="font-semibold mb-2">See What's Happening</h3>
          <p className="text-[14px] text-foreground/70 leading-relaxed">
            Every action, explained. Tool calls show clear intent and description. Meaningful context for each step—not cryptic terminal output.
          </p>
        </div>
      </div>

      {/* Powered by section */}
      <div className="text-center max-w-xl mb-12">
        <p className="text-[14px] text-foreground/60">
          Powered by{' '}
          <a
            href="https://openai.com/codex/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            gpt-5.3-codex
          </a>
          , OpenAI's most capable coding model.
        </p>
      </div>

      <hr className="w-[128px] border-foreground/10" />

      {/* Link to main site */}
      <div className="text-center mt-12">
        <Link
          to="/"
          className="text-[14px] text-foreground/60 hover:text-foreground transition-colors underline"
        >
          Learn more about Craft Agents →
        </Link>
      </div>
    </main>
  )
}
