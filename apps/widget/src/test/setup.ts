import '@testing-library/jest-dom/vitest';

// Polyfill scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = function () {};
