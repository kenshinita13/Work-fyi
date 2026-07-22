import { createServerClient } from "@supabase/ssr";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_ACCOUNT_PASSWORD;

if (!supabaseUrl || !supabaseKey || !password) {
  throw new Error(
    "Supabase and demo account environment variables are required.",
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createSession(email) {
  const cookieJar = new Map();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) cookieJar.set(cookie.name, cookie.value);
      },
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user)
    throw error || new Error(`Sign-in failed for ${email}`);

  return {
    userId: data.user.id,
    async request(path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set(
        "Cookie",
        Array.from(cookieJar, ([name, value]) => `${name}=${value}`).join("; "),
      );
      if (init.method && init.method !== "GET") {
        headers.set("Origin", new URL(appUrl).origin);
      }
      return fetch(new URL(path, appUrl), { ...init, headers });
    },
  };
}

async function json(response) {
  const payload = await response.json();
  return { response, payload };
}

const owner = await createSession("project-manager@demo.work.fyi");
const editor = await createSession("virtual-assistant@demo.work.fyi");
const viewer = await createSession("freelancer@demo.work.fyi");
const unshared = await createSession("cybersecurity@demo.work.fyi");
let documentId;
let importedDocumentId;

try {
  const created = await json(
    await owner.request("/api/documents/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "Collaboration verification",
        format: "md",
        content: "",
        projectId: "none",
        taskId: "none",
      }),
    }),
  );
  assert(
    created.response.status === 201,
    `Create failed: ${created.response.status}`,
  );
  documentId = created.payload.id;
  assert(documentId, "Create response did not include a document ID.");

  const ownerSave = await json(
    await owner.request(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "Collaboration verification.md",
        content: "# Collaboration verification\n\nSaved by the owner.",
        expectedRevision: 1,
      }),
    }),
  );
  assert(
    ownerSave.response.status === 200,
    `Owner save failed: ${ownerSave.response.status}`,
  );
  assert(
    ownerSave.payload.revision === 2,
    "Owner save did not advance the revision.",
  );

  const shared = await json(
    await owner.request(`/api/documents/${documentId}/shares`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visibility: "restricted",
        shares: [
          { userId: editor.userId, permission: "editor" },
          { userId: viewer.userId, permission: "viewer" },
        ],
      }),
    }),
  );
  assert(
    shared.response.status === 200,
    `Share failed: ${shared.response.status}`,
  );
  assert(
    shared.payload.shareCount === 2,
    "Share count did not match the request.",
  );

  const editorPage = await editor.request(`/documents/${documentId}`);
  assert(
    editorPage.status === 200,
    `Editor could not open the document: ${editorPage.status}`,
  );

  const editorSave = await json(
    await editor.request(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "Collaboration verification.md",
        content:
          "# Collaboration verification\n\nUpdated by the shared editor.",
        expectedRevision: 2,
      }),
    }),
  );
  assert(
    editorSave.response.status === 200,
    `Editor save failed: ${editorSave.response.status}`,
  );
  assert(
    editorSave.payload.revision === 3,
    "Editor save did not advance the revision.",
  );

  const viewerPage = await viewer.request(`/documents/${documentId}`);
  assert(
    viewerPage.status === 200,
    `Viewer could not open the document: ${viewerPage.status}`,
  );
  const viewerSave = await viewer.request(`/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: "Collaboration verification.md",
      content: "Viewer edit attempt.",
      expectedRevision: 3,
    }),
  });
  assert(
    viewerSave.status === 403,
    `Viewer save was not denied: ${viewerSave.status}`,
  );

  const unsharedExport = await unshared.request(
    `/api/documents/${documentId}/download`,
  );
  assert(
    unsharedExport.status === 404,
    `Unshared member access was not hidden: ${unsharedExport.status}`,
  );

  const exported = await owner.request(`/api/documents/${documentId}/download`);
  assert(exported.status === 200, `Export failed: ${exported.status}`);
  assert(
    (await exported.text()).includes("Updated by the shared editor."),
    "Export did not contain the latest saved content.",
  );

  const staleSave = await owner.request(`/api/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: "Collaboration verification.md",
      content: "Stale overwrite attempt.",
      expectedRevision: 2,
    }),
  });
  assert(
    staleSave.status === 409,
    `Stale save was not rejected: ${staleSave.status}`,
  );

  const importForm = new FormData();
  importForm.set(
    "file",
    new File(["Imported content."], "Imported verification.txt", {
      type: "text/plain",
    }),
  );
  importForm.set("projectId", "none");
  importForm.set("taskId", "none");
  const imported = await json(
    await owner.request("/api/documents", {
      method: "POST",
      body: importForm,
    }),
  );
  assert(
    imported.response.status === 201,
    `Import failed: ${imported.response.status}`,
  );
  importedDocumentId = imported.payload.id;

  const importedSave = await json(
    await owner.request(`/api/documents/${importedDocumentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "Imported verification.txt",
        content: "Imported and edited inside Work.fyi.",
        expectedRevision: 1,
      }),
    }),
  );
  assert(
    importedSave.response.status === 200,
    `Imported file save failed: ${importedSave.response.status}`,
  );
  const importedExport = await owner.request(
    `/api/documents/${importedDocumentId}/download`,
  );
  assert(importedExport.status === 200, "Imported file export failed.");
  assert(
    (await importedExport.text()) === "Imported and edited inside Work.fyi.",
    "Imported file export did not contain its saved content.",
  );

  console.log("Document collaboration verification passed.");
} finally {
  for (const cleanupId of [documentId, importedDocumentId]) {
    if (!cleanupId) continue;
    const cleanup = await owner.request(`/api/documents/${cleanupId}`, {
      method: "DELETE",
    });
    if (!cleanup.ok) {
      console.warn(`Document cleanup failed with status ${cleanup.status}.`);
    }
  }
}
