# Yantr Design Language

Yantr follows a "High-End Tech" (Linear/Vercel) aesthetic. This design language prioritizes precision, readable data density, elegant micro-interactions, and a sleek monochrome base with highly intentional color accents.

## 1. Core Principles
- **Refined Minimalism:** Use pure black/dark grays (`#0A0A0A`, `zinc-900`) or clean whites for backgrounds. Avoid bulky, soft drop-shadows and glassmorphic blurs.
- **Subtle Boundaries:** Use extremely thin, low-contrast borders (e.g., `border-gray-200 dark:border-zinc-800`) to separate content blocks. Elements should feel flush and grounded.
- **Intentional Color:** The UI is primarily monochrome. Use bright colors *only* for semantic meaning:
  - **Green:** Success, Running, Healthy, Optimized.
  - **Amber/Yellow:** Warning, Pending, Action Required.
  - **Red:** Error, Stopped, Critical.
  - **Blue:** Interactive hover states, links, or primary subtle accents.
- **Data over Decoration:** Focus on clean typography and spacing to present information clearly. Avoid unnecessary decorative boxes if whitespace can do the job.

## 2. Typography
- **Headings:** Medium to Semi-bold (`font-semibold`), tight letter spacing (`tracking-tight`), high contrast text (e.g., `text-gray-900 dark:text-white`).
- **Subtitles & Labels:** Small (`text-[10px]` or `text-xs`), bold (`font-bold`), uppercase, extremely wide letter spacing (`tracking-wider` or `tracking-[0.2em]`), and low contrast (`text-gray-500 dark:text-zinc-500`).
- **Data/Metrics:** Massive, bold numerals (`text-4xl font-bold tracking-tighter tabular-nums`) to make key stats immediately readable.

## 3. Micro-Interactions & Animation
Animations should be butter-smooth, intentional, and not overwhelming. Use `transition-all duration-300` or `duration-500` broadly.
- **Hover Glow Lines:** Interactive cards should reveal a subtle 2px gradient line at the top border on hover (e.g., `bg-gradient-to-r from-transparent via-blue-500 to-transparent`).
- **Hover Patterns:** Reveal a faint, technical dot-grid pattern behind the card content on hover.
- **Expanding Elements:** Badges or statuses should start as simple dots and smoothly expand (width transition) into text-filled pills on hover.
- **Sliding Actions:** Action text (like "Manage ->") should slide up or fade in from an offset position (`translate-y-4 opacity-0` -> `translate-y-0 opacity-100`) on parent hover.
- **Active Pulses:** Use tiny, pulsing dots (`animate-pulse`) for active, real-time states (e.g., a running container).

## 4. Components Structure
- **Cards (`AppCard`, `SystemCleaner`):** 
  - Standard styling: `bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-zinc-800 rounded-xl p-5/6`.
  - Hover state: `hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-2xl hover:-translate-y-1`.
- **Icons:** Use `lucide-vue-next`. Keep them proportionate (usually `size="14"` to `size="24"`), enclosed in subtle border boxes if they act as primary logos, or floating inline with text for labels.
- **Buttons:**
  - *Primary/Active:* High contrast inverted (Black bg in light mode, White bg in dark mode), bold uppercase text.
  - *Secondary/Disabled:* Flat, transparent or slight gray backgrounds (`bg-gray-50 dark:bg-zinc-900`) with subtle text colors.

## 5. Vue & Tailwind Directives
- **Vue Transitions:** Always wrap changing states (like success messages appearing) in `<transition>` components with smooth ease-in/out classes.
- **Tailwind Groups:** Rely heavily on Tailwind's `group` and `group-hover:` classes to trigger complex, synchronized animations across multiple child elements when a parent card is hovered.
