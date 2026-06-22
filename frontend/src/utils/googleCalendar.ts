// googleCalendar.ts
import dayjs from "dayjs";
import { Task } from "@/types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

const TOKEN_STORAGE_KEY = "gcal_access_token";
const TOKEN_EXPIRY_KEY = "gcal_token_expiry";

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

/**
 * Dynamically loads a script
 */
const loadScript = (src: string, globalVar: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalVar]) {
      resolve();
      return;
    }

    let script = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const onScriptLoad = () => resolve();
    const onScriptError = () => reject(new Error(`Failed to load ${src}`));

    script.addEventListener("load", onScriptLoad);
    script.addEventListener("error", onScriptError);
  });
};

/**
 * Initializes the Google API client and Identity Services
 */
export const initGoogleCalendarAPI = async (): Promise<void> => {
  if (gapiInited && gisInited) return;

  if (!CLIENT_ID || !API_KEY) {
    console.error(`Missing Google API credentials. CLIENT_ID: ${!!CLIENT_ID}, API_KEY: ${!!API_KEY}`);
    throw new Error("Missing Google API credentials in .env file. Please ensure NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY are set and restart the server.");
  }

  try {
    // Load gapi
    await loadScript("https://apis.google.com/js/api.js", "gapi");
    await new Promise<void>((resolve) => {
      window.gapi.load("client", async () => {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        resolve();
      });
    });

    // Load Google Identity Services
    await loadScript("https://accounts.google.com/gsi/client", "google");
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => { }, // Defined later
    });
    gisInited = true;
  } catch (error) {
    console.error("Error initializing Google API:", error);
    throw error;
  }
};

/**
 * Logs the user in and requests scopes
 */
export const connectGoogleCalendar = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (!tokenClient) {
      try {
        await initGoogleCalendarAPI();
      } catch (err) {
        reject(err);
        return;
      }

      if (!tokenClient) {
        reject(new Error("Token client failed to initialize"));
        return;
      }
    }

    if (window.gapi.client.getToken() !== null) {
      resolve(); // Already connected
      return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
        return;
      }

      // Set the token explicitly in gapi client since GIS does not do it automatically
      const newToken = { access_token: resp.access_token };
      window.gapi.client.setToken(newToken);

      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(newToken));
      // Approximate expiry (GIS tokens usually last 3599 seconds)
      const expiresIn = resp.expires_in || 3599;
      localStorage.setItem(TOKEN_EXPIRY_KEY, (Date.now() + (expiresIn * 1000)).toString());

      resolve();
    };

    tokenClient.requestAccessToken();
  });
};

/**
 * Checks if we currently have an access token
 */
export const checkGoogleCalendarConnection = async (): Promise<boolean> => {
  await initGoogleCalendarAPI();

  const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (savedToken && expiry && Date.now() < parseInt(expiry, 10)) {
    window.gapi.client.setToken(JSON.parse(savedToken));
    return true;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  return window.gapi.client.getToken() !== null;
};

/**
 * Disconnects (clears the token)
 */
export const disconnectGoogleCalendar = () => {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token, () => {
      window.gapi.client.setToken("");
    });
  }
};

/**
 * Fetches events from the user's primary calendar and converts them to Gantt Tasks
 */
export const fetchCalendarEventsAsTasks = async (timeMin: Date, timeMax: Date): Promise<Task[]> => {
  if (!(await checkGoogleCalendarConnection())) return [];

  try {
    const response = await window.gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      showDeleted: false,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.result.items;

    return (events || []).map((event: any) => {
      // Determine start and end. Google Calendar can have dateTime or just date (all day)
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        id: `gcal-${event.id}`,
        title: event.summary || "(No Title)",
        description: event.description || "",
        startDate: new Date(start).toISOString(),
        dueDate: new Date(end).toISOString(),
        priority: "MEDIUM",
        status: {
          id: "gcal-status",
          name: "Sự kiện",
          category: "TODO",
        },
        type: "GCAL_EVENT", // custom type to identify it
        isArchived: false,
        assignees: [], // can optionally put the current user here
        // We inject this extra flag to easily identify them
        isGCalEvent: true,
        originalEventId: event.id,
        project: {
          id: "gcal-project",
          name: "Lịch cá nhân",
          slug: "lich-ca-nhan",
        },
        projectId: "gcal-project",
        createdAt: event.created || new Date().toISOString(),
        updatedAt: event.updated || new Date().toISOString(),
      } as unknown as Task;
    });
  } catch (error) {
    console.error("Error fetching Google Calendar events:", error);
    return [];
  }
};

/**
 * Updates an event's start and end times
 */
export const updateCalendarEventTime = async (eventId: string, newStart: string, newEnd: string): Promise<boolean> => {
  if (!(await checkGoogleCalendarConnection())) return false;

  try {
    // Fetch the existing event to keep its other properties
    const getResponse = await window.gapi.client.calendar.events.get({
      calendarId: "primary",
      eventId: eventId,
    });

    const event = getResponse.result;

    // Update start and end
    // For simplicity, we assume they are dateTime. If they were all-day, they'd become dateTime.
    event.start = { dateTime: newStart };
    event.end = { dateTime: newEnd };

    await window.gapi.client.calendar.events.update({
      calendarId: "primary",
      eventId: eventId,
      resource: event,
    });

    return true;
  } catch (error) {
    console.error("Error updating Google Calendar event:", error);
    return false;
  }
};
