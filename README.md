# Impact Framework 🎯

A distractionless, high-focus 4-quadrant task prioritization matrix designed with a paper-clean aesthetic and fluid Google Docs style smooth typing.

## Features

- **4-Quadrant Matrix**:
  - **High Impact, Easy to Do** (*Do First*)
  - **High Impact, Hard to Do** (*Schedule*)
  - **Low Impact, Easy to Do** (*Delegate*)
  - **Low Impact, Hard to Do** (*Eliminate*)
- **Docs Silk Typing Engine**: Custom gliding caret with fluid forward and backspace animations.
- **Physical Drag & Drop**: Seamlessly move tasks between blocks and reorder in-between tasks with zero shadow and instant placement.
- **Privacy & Security**:
  - **Zero Central Database**: All data lives locally in the user's browser storage (`localStorage`).
  - **Hardened Security**: Strict Content Security Policy (CSP), anti-clickjacking (`X-Frame-Options: DENY`), and nosniff protections.
- **Zero Friction**: No signup, no login screens. Just open the link and start prioritizing.

## Local Development

```bash
# Using npx
npx serve .

# Or using Python
python -m http.server 3000
```
Open the provided local URL in your browser.

## Deployment

Optimized for 1-click deployment on [Vercel](https://vercel.com) via `vercel.json`.
