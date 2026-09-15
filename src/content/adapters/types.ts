export interface SiteAdapter {
  id: string;
  displayName: string;
  matchesHost(hostname: string): boolean;

  /** Locates the prompt input (textarea or contenteditable) currently on screen. */
  findInput(): HTMLElement | null;

  /** Locates the send/submit button associated with the given input, if any. */
  findSendButton(input: HTMLElement): HTMLElement | null;

  /** Locates the container that AI responses get appended to, for response restoration. */
  findResponseContainer(): HTMLElement | null;

  getText(input: HTMLElement): string;
  setText(input: HTMLElement, text: string): void;
}
