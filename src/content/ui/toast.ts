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
  .action {
    display: block;
    margin-top: 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: #ffffff;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }
  .action:hover { background: rgba(255, 255, 255, 0.12); }
`;

interface ToastAction {
  label: string;
  onClick: () => void;
}

export function showToast(message: string, durationMsOrAction?: number | ToastAction, durationMs = 8000): void {
  const action = typeof durationMsOrAction === "object" ? durationMsOrAction : undefined;
  const duration = typeof durationMsOrAction === "number" ? durationMsOrAction : durationMs;

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

  if (action) {
    const button = document.createElement("button");
    button.className = "action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      host.remove();
      action.onClick();
    });
    toast.appendChild(button);
  }

  setTimeout(() => host.remove(), duration);
}
