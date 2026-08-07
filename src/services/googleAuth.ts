import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_WEB_CLIENT_ID =
  "399072374843-k81igsg3cq9obh791cn5b6qkmpk9qtev.apps.googleusercontent.com";

export const useGoogleSignIn = () => {
  return Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });
};