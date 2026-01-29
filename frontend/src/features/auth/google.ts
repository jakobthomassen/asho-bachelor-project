import { API_BASE_URL } from "../../config";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};
type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback?: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: "popup" | "redirect";
    login_uri?: string;
  }) => void;
  prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void;
  disableAutoSelect?: () => void;
  renderButton?: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      type?: "standard" | "icon";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
    }
  ) => void;
};

type PromptMomentNotification = {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 50;

async function waitForGoogleIdentity(): Promise<GoogleAccountsId | null> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const id = window.google?.accounts?.id;
    if (id) return id;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}

export async function initGoogleIdentity(options: {
  clientId: string;
  onCredential?: (response: GoogleCredentialResponse) => void;
}): Promise<boolean> {
  const id = await waitForGoogleIdentity();
  if (!id) return false;

  id.initialize({
    client_id: options.clientId,
    callback: options.onCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    ux_mode: "redirect",
    login_uri: `${API_BASE_URL}/api/auth/google/redirect`,
  });

  return true;
}

export async function promptGoogleSignIn(): Promise<boolean> {
  const id = await waitForGoogleIdentity();
  if (!id) return false;
  id.prompt();
  return true;
}

export function disableGoogleAutoSelect(): void {
  window.google?.accounts?.id?.disableAutoSelect?.();
}

export async function renderGoogleButton(
  container: HTMLElement,
  options?: {
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    width?: number;
  }
): Promise<boolean> {
  const id = await waitForGoogleIdentity();
  if (!id || !id.renderButton) return false;
  container.innerHTML = "";
  id.renderButton(container, {
    theme: options?.theme ?? "outline",
    size: options?.size ?? "large",
    text: options?.text ?? "signin_with",
    width: options?.width,
  });
  return true;
}

export function clickRenderedButton(container: HTMLElement): boolean {
  const button = container.querySelector("div[role=button]") as HTMLElement | null;
  if (!button) return false;
  button.click();
  return true;
}
