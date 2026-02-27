export const BROWSER_LIVE_FX = {
  rootId: '__craft_agent_live_fx__',
  borderId: '__craft_agent_live_fx_border__',
  chipId: '__craft_agent_live_fx_chip__',
  cursorId: '__craft_agent_live_fx_cursor__',
  styleId: '__craft_agent_live_fx_style__',

  borderRadius: '8px',
  borderBackgroundImage:
    'repeating-linear-gradient(45deg, rgba(var(--accent-rgb, 104, 78, 133), 0.42) 0 2px, rgba(var(--accent-rgb, 104, 78, 133), 0.0) 2px 4px), repeating-linear-gradient(135deg, rgba(217,70,239,0.35) 0 2px, rgba(217,70,239,0.0) 2px 4px)',
  borderBackgroundSize: '8px 8px, 10px 10px',
  borderBackgroundPosition: '0 0, 0 0',
  borderBoxShadow:
    '0 0 18px rgba(var(--accent-rgb, 104, 78, 133), 0.35), 0 0 26px rgba(217,70,239,0.22), inset 0 0 10px rgba(var(--accent-rgb, 104, 78, 133), 0.25)',
  borderMaskImage: 'radial-gradient(ellipse at center, transparent 58%, black 88%, black 100%)',
  borderAnimation:
    '__craft_agent_fx_dither 1.2s linear infinite, __craft_agent_fx_pulse 1.8s ease-in-out infinite',

  chipTop: '8px',
  chipRight: '8px',
  chipPadding: '4px 8px',
  chipRadius: '7px',
  chipFont: '11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  chipBackground: 'rgba(2, 6, 23, 0.82)',
  chipColor: 'rgba(236, 254, 255, 0.95)',
  chipBackdropFilter: 'blur(4px)',

  cursorWidth: '18px',
  cursorHeight: '22px',
  cursorFilter: 'drop-shadow(0 0 8px rgba(0,0,0,0.35))',
  cursorTransition: 'left 120ms ease, top 120ms ease',
  cursorOffset: 2,
  cursorInnerHtml:
    '<div style="width:100%;height:100%;background:black;clip-path:polygon(0% 0%,0% 100%,34% 73%,51% 100%,66% 94%,48% 67%,100% 67%);border-radius:2px;outline:1px solid rgba(255,255,255,0.75);"></div>',

  keyframesCss:
    '@keyframes __craft_agent_fx_dither{from{background-position:0 0,0 0}to{background-position:8px 8px,-10px 10px}}@keyframes __craft_agent_fx_pulse{0%,100%{opacity:.35}50%{opacity:.9}}',
} as const
