# REPLEO design guide

## Brand and direction

The product is named **REPLEO**. Keep repository and internal service identifiers intact unless an infrastructure migration explicitly needs them; visible UI, page metadata, and new product-facing copy use REPLEO.

The approved public direction is cinematic and editorial: a quiet Japanese night landscape, a restrained moonlit horizon, and a fine emerald particle stream that visualizes comment → keyword → Direct. Avoid generic SaaS dashboards in the public hero, oversized gradients, repeated glowing cards, and decorative claims that imply fabricated analytics.

## Palette and type

- Ink: `#080d0b`; forest: `#0c1712`; deep surface: `#111a15`.
- Primary accent: soft emerald `#5be0ab`; pale mint is reserved for highlights.
- Warm amber is a rare particle/detail color. Keep it semantically separate from success/warning states.
- Use the existing system sans stack with compact, carefully balanced headings and comfortable body line-height.
- Workspace data surfaces stay calm: flat surfaces, quiet borders, and restrained shadows. Keep the dark sidebar and use forest/emerald active states.
- Light theme remains readable and theme-aware; public marketing may keep the approved dark cinematic treatment.

## Layout and motion

- The landing page hero pairs concise product copy with the landscape and particle flow. Below it, explain the real comment-to-DM sequence and follower outcomes.
- Keep automation setup focused on account, post, keywords, and reply content. Do not add billing, demo accounts, fabricated metrics, or irrelevant controls.
- Preserve the existing responsive workspace shell and touch-friendly controls at mobile widths.
- Use motion to clarify the event path: slow orbital drift, subtle particles, and small hover/entrance transitions. Do not animate every card.
- Respect `prefers-reduced-motion`; canvas animation must stop and CSS animation must be reduced.
- Maintain UZ/RU/EN translations, keyboard-visible focus, accessible labels, and sufficient contrast.

## Product truth and states

- Use only real backend values for connected accounts, executions, and analytics.
- Follow status remains `FOLLOWER`, `NOT_FOLLOWER`, or `UNKNOWN`; errors and missing fields are never “not following”.
- A public “DM sent” reply is only shown after Meta confirms private-reply success.
- Keep loading, empty, permission-denied, disconnected, error, and success states clear and distinct.
