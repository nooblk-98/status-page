## 2024-05-22 - Accessibility Enhancements for Dashboard and Forms

**Learning:** Converting core interactive elements from JS-driven `div`s to semantic HTML elements (`<a>`) significantly improves out-of-the-box accessibility (keyboard navigation, screen reader support) and reduces the need for manual event listeners and inline styles.

**Action:** Always prefer semantic links or buttons over clickable `div`s. Ensure all form controls have associated labels and use ARIA attributes like `aria-pressed` for toggle-like states.
