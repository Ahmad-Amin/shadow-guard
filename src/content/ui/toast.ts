const TOAST_STYLES = `
  :host { all: initial; }
  .toast {
    position: fixed;
    z-index: 2147483647;
    bottom: 96px;
    right: 24px;
    max-width: 320px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12.5px;
    line-height: 1.4;
    background: #13233f;
    color: #ffffff;
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 12px 32px rgba(15, 30, 60, 0.24);
    animation: shadowguard-toast-in 160ms ease-out;
  }
  @keyframes shadowguard-toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export function showToast(message: string, durationMs = 5000): void {
  const host = document.createElement("div");
  host.setAttribute("data-shadowguard-toast", "");
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = TOAST_STYLES;
  shadow.appendChild(style);

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  shadow.appendChild(toast);

  setTimeout(() => host.remove(), durationMs);
}
