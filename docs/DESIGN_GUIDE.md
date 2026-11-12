# IDS Automate — design system

## Visual direction

Use a warm paper canvas, deep forest-green structure, and restrained citrus accents. The product should feel calm, precise, and premium through strong type hierarchy, generous spacing, fine borders, and soft depth. Avoid the former violet/lavender palette, heavy glow, and dense dashboard decoration. Instagram marks retain Instagram’s official gradient colors.

The same visual language applies to the marketing site, Meta connection/setup, workspace shell, automation builder, Inbox, analytics, team, settings, and profile. Light mode is the default; dark mode uses charcoal-green surfaces and citrus highlights.

## Layout and type

- Desktop workspace shell: compact forest sidebar, translucent top bar, flexible content column.
- Main content max width: 1600px; use a consistent 4/8px spacing rhythm.
- Use the system Aptos/Segoe UI stack with tight display headings and readable body copy.
- Keep cards quiet: white or charcoal-green surface, fine border, 16–20px radius, restrained shadow.
- Mobile: compact top bar, single-column content, persistent bottom navigation, touch-sized controls.
- Keep 360px, 768px, and 1440px layouts usable.

## Components and motion

- Primary actions: forest gradient; selected states: citrus; secondary actions: calm surface with a fine border.
- Inputs and custom menus use clear labels, visible keyboard focus, and theme-aware surfaces.
- Status keeps semantic meaning: green success, amber warning, red failure, neutral unknown.
- Charts use real values only; tables and lists reflow for narrow screens.
- Use short entrance and hover transitions. Respect `prefers-reduced-motion`.
- Follow status must visibly distinguish `FOLLOWER`, `NOT_FOLLOWER`, and `UNKNOWN`.
- A public success reply must never appear complete before confirmed private-reply success.

## UX states

Every asynchronous screen needs loading, empty, error, success, permission-denied, and disconnected states where relevant.
