# Design guide — IDS Automate

## Visual direction
Premium dark SaaS, deep navy canvas, violet/indigo action color, restrained cyan status accents. Use subtle borders and soft shadows rather than heavy glow.

## Main screens
1. Public landing page
2. Login
3. Registration
4. Forgot/reset password
5. Dashboard
6. Instagram accounts
7. Automation list
8. Automation create/edit
9. Inbox
10. Analytics
11. Team
12. Execution history and errors
13. Settings/integrations
14. Profile

## Layout
- Desktop app shell: 248px sidebar, flexible content, 72px topbar.
- Tablet: collapsible sidebar.
- Mobile: compact topbar and bottom navigation or drawer.
- Content max width around 1440px.
- Use consistent 8px spacing scale.

## Components
- Button variants: primary violet, secondary outline, ghost, destructive.
- Cards: dark surface, 1px subtle border, 16px radius.
- Inputs: dark surface, visible labels, focus ring.
- Status: connected green, warning amber, disconnected muted red.
- Charts: clear axes and tooltips; never fabricate production metrics.
- Tables: responsive cards on narrow screens.
- Follow status must visibly distinguish `FOLLOWER`, `NOT_FOLLOWER` and `UNKNOWN`.
- Public success reply must never appear as completed before confirmed private-reply success.

## UX states
Every async screen needs loading, empty, error, success, permission denied and disconnected states where relevant.
