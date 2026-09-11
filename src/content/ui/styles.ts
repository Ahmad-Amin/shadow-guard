export const PANEL_STYLES = `
  :host {
    all: initial;
  }
  .panel {
    position: fixed;
    z-index: 2147483647;
    bottom: 96px;
    right: 24px;
    width: 340px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #ffffff;
    color: #13233f;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(15, 30, 60, 0.24);
    border: 1px solid #dfe6f1;
    overflow: hidden;
    animation: shadowguard-slide-in 160ms ease-out;
  }
  @keyframes shadowguard-slide-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: #13233f;
    color: #ffffff;
  }
  .header .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff5c5c;
  }
  .header .dot.warn { background: #f5b700; }
  .header .dot.redact { background: #3a86ff; }
  .header strong {
    font-size: 13px;
    letter-spacing: 0.02em;
  }
  .body {
    padding: 12px 14px;
    max-height: 220px;
    overflow-y: auto;
  }
  .summary {
    font-size: 12.5px;
    color: #4a5a78;
    margin: 0 0 8px;
  }
  .match-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .match-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12.5px;
    padding: 6px 8px;
    border-radius: 8px;
    background: #f4f7fc;
  }
  .badge {
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .badge.CRITICAL { background: #ffe1e1; color: #a4121a; }
  .badge.HIGH { background: #ffe9cc; color: #a4560c; }
  .badge.MEDIUM { background: #e1ecff; color: #1a4fa4; }
  .badge.LOW { background: #eaeaea; color: #555; }
  .footer {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid #eef1f6;
  }
  button {
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    flex: 1;
  }
  button.primary {
    background: #13233f;
    color: #ffffff;
  }
  button.primary:hover { background: #1c3357; }
  button.secondary {
    background: #f0f2f6;
    color: #13233f;
  }
  button.secondary:hover { background: #e3e7ef; }
  button.ghost {
    background: transparent;
    color: #7a8aa8;
  }
  button.ghost:hover { color: #4a5a78; }
  .explain {
    font-size: 11.5px;
    color: #7a8aa8;
    margin: 8px 0 0;
    line-height: 1.4;
  }
`;
