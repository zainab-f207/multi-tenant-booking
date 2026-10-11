import { test, expect, type Page } from "@playwright/test";

const BOOKING_ID = "d0000000-0000-4000-8000-000000000001";
const PASSWORD = "Password123!";

const ADMIN_EMAIL = "ayesha.khan@technova.dev";
const MANAGER_EMAIL = "bilal.ahmed@technova.dev";

const bookingUrl = `/dashboard/bookings/${BOOKING_ID}`;

let originalContent = "";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
}

async function openBooking(page: Page, email: string) {
  await login(page, email);
  await page.goto(bookingUrl);

  await expect(page.locator("#booking-note")).toBeVisible();
  await expect(page.getByText("Live connection")).toBeVisible();
}

async function saveNote(page: Page, content: string) {
  const textarea = page.locator("#booking-note");

  await textarea.fill(content);

  const saveButton = page.getByRole("button", { name: "Save note" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(textarea).toHaveValue(content);
}

function attachDiagnostics(page: Page, label: string) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`[${label} Browser console error]`, message.text());
    }
  });

  page.on("pageerror", (error) => {
    console.log(`[${label} Browser page error]`, error.message);
  });

  page.on("request", (request) => {
    if (request.url().includes("/socket.io")) {
      console.log(
        `[${label} Socket.IO request]`,
        request.method(),
        request.url()
      );
    }
  });

  page.on("response", (response) => {
    if (response.url().includes("/socket.io")) {
      console.log(
        `[${label} Socket.IO response]`,
        response.status(),
        response.url()
      );
    }
  });

  page.on("requestfailed", (request) => {
    if (request.url().includes("/socket.io")) {
      console.log(
        `[${label} Socket.IO request failed]`,
        request.url(),
        request.failure()?.errorText
      );
    }
  });
}

test.describe.serial("Shared booking notes", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();

    try {
      await openBooking(page, ADMIN_EMAIL);
      originalContent = await page.locator("#booking-note").inputValue();
    } finally {
      await page.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    // Restore the seeded booking's original note content.
    const page = await browser.newPage();

    try {
      await openBooking(page, ADMIN_EMAIL);

      const textarea = page.locator("#booking-note");
      const currentContent = await textarea.inputValue();

      if (currentContent !== originalContent) {
        await saveNote(page, originalContent);
      }
    } finally {
      await page.close();
    }
  });

  test("another user sees a saved note without refreshing", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      attachDiagnostics(pageA, "User A");
      attachDiagnostics(pageB, "User B");

      await openBooking(pageA, ADMIN_EMAIL);
      await openBooking(pageB, MANAGER_EMAIL);

      const updatedContent = `Live sync test ${Date.now()}`;

      await saveNote(pageA, updatedContent);

      // No page reload: the second browser should receive the socket update.
      await expect(pageB.locator("#booking-note")).toHaveValue(
        updatedContent
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("reconnects and retrieves changes made while offline", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      pageA.on("console", (message) => {
      console.log("[Browser output]", message.type(), message.text());
      });
      const pageB = await contextB.newPage();

      // Attach diagnostics before either page opens a Socket.IO connection.
      attachDiagnostics(pageA, "Reconnect User A");
      attachDiagnostics(pageB, "Reconnect User B");

      await openBooking(pageA, ADMIN_EMAIL);
      await openBooking(pageB, MANAGER_EMAIL);

      console.log("[Reconnect test] Taking User A offline");

      // Disconnect only browser A, not the whole computer or server.
      await contextA.setOffline(true);

      await expect(pageA.getByText(/reconnecting/i)).toBeVisible();

      const updatedContent = `Reconnect test ${Date.now()}`;

      // Browser B stays online and saves a new version.
      await saveNote(pageB, updatedContent);

      console.log("[Reconnect test] Bringing User A back online");

      // Bring browser A back online.
      await contextA.setOffline(false);

      // Wait for the application to report a successful Socket.IO connection.
      await expect(pageA.getByText("Live connection")).toBeVisible({
        timeout: 20000,
      });

      // On reconnect, the component should fetch the latest saved note.
      await expect(pageA.locator("#booking-note")).toHaveValue(
        updatedContent,
        { timeout: 10000 }
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("preserves a stale draft and displays a conflict", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      pageA.on("console", (message) => {
      console.log("[Browser output]", message.type(), message.text());
      });
      const pageB = await contextB.newPage();

      attachDiagnostics(pageA, "Conflict User A");
      attachDiagnostics(pageB, "Conflict User B");

      await openBooking(pageA, ADMIN_EMAIL);
      await openBooking(pageB, MANAGER_EMAIL);

      // Browser B starts a draft but does not save it.
      const staleDraft = `Stale draft ${Date.now()}`;
      await pageB.locator("#booking-note").fill(staleDraft);

      // Browser A saves a newer version of the note.
      const newerContent = `Newer saved version ${Date.now()}`;
      await saveNote(pageA, newerContent);

      // Browser B should detect the version change and preserve its draft.
      await expect(
        pageB.getByText("This note was changed by someone else.")
      ).toBeVisible();

      await expect(pageB.locator("#booking-note")).toHaveValue(staleDraft);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
