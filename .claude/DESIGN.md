# ACRUE Design System

## Vibe

Dark, data-dense, high-tech but refined — think Bloomberg meets old money.
Navy is the foundation. Gold is used sparingly as the sole accent.
The feel should be luxurious and serious, not flashy.

---

## Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `gold-400` | `#F7F3E5` | Primary accent — text, icons, active states |
| `gold-500` | `#EDE4CC` | Slightly darker gold, gradient midpoint |
| `gold-600` | `#D4CCAE` | Muted gold, button gradient start |
| `navy-950` | `#020810` | Deepest background |
| `navy-900` | `#050D1A` | Page background |
| `navy-800` | `#0A1628` | Card / surface background |
| `navy-700` | `#0F1F38` | Elevated surface |
| `navy-600` | `#152848` | Border, divider |
| `navy-500` | `#1A3158` | Subtle highlight |
| `text-primary` | `#E8E8F0` | Primary text |
| `text-secondary` | `#A0ABBE` | Secondary / label text |
| `text-muted` | `#5C6880` | Placeholder, meta text |

---

## Typography

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Headings (`h1`, `h2`, `h3`) | DM Serif Display | 400 | Elegant, editorial |
| Body | Inter | 300–600 | Clean, modern |
| Numbers / code / data | DM Mono | 300–500 | Financial figures, tickers |

Loaded via `next/font/google` — self-hosted, no external request.

---

## Effects

### Gold Text Glow
Applied globally to all `h1`:
```css
text-shadow: 0 0 24px rgba(247, 243, 229, 0.25), 0 0 48px rgba(247, 243, 229, 0.08);
```

Use `.text-glow-gold` utility class for manual application:
```css
text-shadow: 0 0 12px rgba(247, 243, 229, 0.6), 0 0 24px rgba(247, 243, 229, 0.2);
```

### Gold Element Glow (box-shadow)
| Class | Usage |
|-------|-------|
| `.glow-gold-sm` | Subtle — active nav indicators, small accents |
| `.glow-gold` | Default — buttons, highlighted cards |
| `.glow-gold-lg` | Strong — primary CTA hover state |

Values:
```css
--glow-gold-sm: 0 0 8px rgba(247,243,229,0.25), 0 0 16px rgba(247,243,229,0.08);
--glow-gold:    0 0 12px rgba(247,243,229,0.35), 0 0 28px rgba(247,243,229,0.12);
--glow-gold-lg: 0 0 20px rgba(247,243,229,0.45), 0 0 48px rgba(247,243,229,0.18);
```

### Background Radial Glow
Used on auth pages (login/register) for depth:
```css
radial-gradient(ellipse 60% 40% at 50% 0%, rgba(247,243,229,0.07) 0%, transparent 70%)
```

---

## Components

### Buttons
- Primary: gold gradient (`#D4CCAE` → `#F7F3E5`), dark navy text (`#050D1A`)
- Add `.glow-gold` on default, `.glow-gold-lg` on hover
- Border radius: `rounded-xl`

### Inputs
- Background: `navy-800`
- Default border: `rgba(26,45,74,1)` (navy-600)
- Focus border: `rgba(247,243,229,0.5)` + ring `rgba(247,243,229,0.06)`
- Smooth transition on focus/blur via inline `onFocus`/`onBlur`

### Cards / Surfaces
- Background: `rgba(10, 22, 40, 0.8)` with `backdrop-filter: blur(12px)`
- Border: `rgba(247,243,229,0.15)`
- Border radius: `rounded-2xl`

### Sidebar
- Background: `rgba(5, 13, 26, 0.95)`
- Brand centered: `Acrue` in DM Serif Display, gold-400, with glow
- Slogan: `"Invest with clarity"` — small, muted, tracked wide
- Active nav item: gold text + gold background tint + gold left indicator bar with glow
- Dividers: `rgba(247,243,229,0.1)`

---

## Rules

- Gold is accent only — never use it for large background fills
- Never use pure white — use `text-primary` (`#E8E8F0`) instead
- Keep glow effects subtle — they enhance, not overpower
- All heading fonts use DM Serif Display — never Inter for h1/h2/h3
- Data figures (prices, percentages, scores) always use DM Mono
