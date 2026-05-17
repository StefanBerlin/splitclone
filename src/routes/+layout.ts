// SplitClone runs entirely in the browser and talks to OneDrive directly
// (SC-ARC-HST-1: no application server). Disable SSR and prerendering so the
// static adapter produces a single SPA shell.
export const ssr = false;
export const prerender = false;
