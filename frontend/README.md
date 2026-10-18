# Whyline Frontend Client

Enterprise intelligence interface for Whyline built with Next.js 16 (App Router), Turbopack, and Tailwind CSS.

---

## 🛠 Tech Stack
- **Framework:** Next.js 16.3.8 (React 19, Turbopack)
- **Styling:** Tailwind CSS 4.0 with Material Design token system
- **Icons:** Material Symbols & Lucide React
- **Theme:** Dark & Light mode toggle with high-contrast system defaults
- **Visuals:** Cytoscape.js & Canvas-based graph topology renderers
- **Streaming:** Server-Sent Events (SSE) consumer for real-time agent reasoning steps

---

## 📂 Application Routes

```
frontend/app/
├── (auth)/
│   ├── login/              # Multi-tenant login with email/password & OTP
│   └── signup/             # Employee signup with company dropdown selection
├── admin/                  # Platform Admin Console (user approval & tenant creation)
├── company-admin/          # Company Admin portal for reviewing new employee registrations
├── ask-whyline/            # AI Agent chat with real-time graph reasoning & path proof
├── decisions/              # Decision records, provenance inspector & related tickets
├── impact-analysis/        # 4-hop blast radius canvas & change simulation
├── ownership-bus-factor/   # Knowledge concentration & orphaned systems detector
├── rag-comparison/         # Head-to-head split screen (Vector RAG vs Whyline GraphRAG)
├── graph-explorer/         # Interactive Cypher query runner & node visualizer
└── tickets/                # Engineering ticket management and creation
```

---

## 🚀 Running the Frontend (Powered by Bun)

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Or build and run for production
bun run build
bun start
```

Default URL: **[http://localhost:3000](http://localhost:3000)**
Backend proxy: Configured to point to `http://localhost:8080`.
