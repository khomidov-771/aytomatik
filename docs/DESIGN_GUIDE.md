# IDS Automate — violet design system

## Visual direction

Use a clean light canvas, a compact ink-navy workspace sidebar, and confident violet accents. The product should feel calm and premium through clear typography, generous spacing, fine borders, and restrained shadows. Use gradient violet only for primary actions and active navigation; reserve Instagram's own gradient for Instagram marks.

Apply the same system to the public site, Meta connection/setup, workspace, automation builder, Inbox, analytics, team, settings, and profile. Light mode is the default. Dark mode uses deep charcoal-navy surfaces, readable muted text, and soft violet highlights. Semantic green, amber, and red continue to mean success, warning, and failure.

## Layout and type

- Desktop workspace: compact dark sidebar, translucent top bar, flexible content column, and a 1600px content maximum.
- Use a consistent 4/8px spacing rhythm and 16–20px card radii.
- Use the system Inter/Segoe UI stack with tight display headings and readable body copy.
- Keep cards quiet: white or charcoal surfaces, fine borders, and restrained shadows.
- Mobile: compact top bar, single-column content, persistent bottom navigation, and touch-sized controls.
- Keep 360px, 768px, and 1440px layouts usable.

## Components and motion

- Primary actions and selected states use violet; secondary actions use calm surfaces and fine borders.
- Inputs and custom menus use clear labels, visible keyboard focus, and theme-aware surfaces.
- Status keeps semantic meaning: green success, amber warning, red failure, and explicit unknown.
- Charts use backend values only; never add fabricated metrics.
- Use short entrance and hover transitions. Respect `prefers-reduced-motion`.
- Follow status must distinguish `FOLLOWER`, `NOT_FOLLOWER`, and `UNKNOWN`.
- Public success text must never appear complete before confirmed private-reply success.
- Automation matching preview must call the backend matcher and state clearly that it sends no messages.

## UX states

Every asynchronous screen needs loading, empty, error, success, permission-denied, and disconnected states where relevant. Maintain UZ/RU/EN translations and contrast in both light and dark themes.

