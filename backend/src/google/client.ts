import { google } from "googleapis";
import { config } from "../config.js";
import { getValidAccessToken } from "./tokenRefresh.js";

export async function getOAuth2Client(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  const oauth2 = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}

export async function getGmail(userId: string) {
  const auth = await getOAuth2Client(userId);
  return google.gmail({ version: "v1", auth });
}

export async function getCalendar(userId: string) {
  const auth = await getOAuth2Client(userId);
  return google.calendar({ version: "v3", auth });
}

export async function getDocs(userId: string) {
  const auth = await getOAuth2Client(userId);
  return google.docs({ version: "v1", auth });
}

export async function getSheets(userId: string) {
  const auth = await getOAuth2Client(userId);
  return google.sheets({ version: "v4", auth });
}

export async function getDrive(userId: string) {
  const auth = await getOAuth2Client(userId);
  return google.drive({ version: "v3", auth });
}
