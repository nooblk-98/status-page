# Palette: UX Learning & Standards

- **Notification Dropdown**:
  - Polling `/api/dashboard` every 30s provides a reliable source for notification events without additional backend endpoints.
  - Notifications are derived from state transitions (UP -> DOWN, DOWN -> UP) in the check history.
  - Using `localStorage` for `readAt` and `clearedAt` allows for client-side unread tracking without persistent backend storage for notification state.
  - Design includes a colored header bar (indigo), unread badge with ring, and a "Clear Notifications" button with a trash icon.
  - Teal dot with glow effect (`shadow-[0_0_8px_rgba(20,184,166,0.5)]`) is used for unread indicators to match modern UI patterns.
