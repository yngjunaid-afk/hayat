import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

import { auth } from "./firebase";

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function initRecaptcha(
  containerId = "recaptcha-container"
) {
  if (typeof window === "undefined") {
    return null;
  }

  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(
      auth,
      containerId,
      {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          recaptchaVerifier = null;
        },
      }
    );
  }

  return recaptchaVerifier;
}

export async function sendPhoneOtp(
  phoneNumber: string
): Promise<ConfirmationResult> {
  const verifier = initRecaptcha();

  if (!verifier) {
    throw new Error("reCAPTCHA is not available.");
  }

  const confirmationResult =
    await signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier
    );

  return confirmationResult;
}