import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const password =
  process.env.DEMO_ACCOUNT_PASSWORD ??
  `WorkFyi!${randomBytes(9).toString("base64url")}`;

const accounts = [
  {
    email: "project-manager@demo.work.fyi",
    fullName: "Morgan Project Manager",
    workspaceRole: "owner",
    primaryRole: "project_manager",
    primaryUseCase: "project_management",
  },
  {
    email: "administrator@demo.work.fyi",
    fullName: "Alex Administrator",
    workspaceRole: "admin",
    primaryRole: "administrator",
    primaryUseCase: "administration",
  },
  {
    email: "cybersecurity@demo.work.fyi",
    fullName: "Casey Cybersecurity Analyst",
    workspaceRole: "member",
    primaryRole: "cybersecurity_specialist",
    primaryUseCase: "cybersecurity",
  },
  {
    email: "virtual-assistant@demo.work.fyi",
    fullName: "Val Virtual Assistant",
    workspaceRole: "member",
    primaryRole: "virtual_assistant",
    primaryUseCase: "virtual_assistance",
  },
  {
    email: "freelancer@demo.work.fyi",
    fullName: "Frankie Freelancer",
    workspaceRole: "viewer",
    primaryRole: "freelancer",
    primaryUseCase: "freelancing",
  },
  {
    email: "other-role@demo.work.fyi",
    fullName: "Taylor Demo Viewer",
    workspaceRole: "viewer",
    primaryRole: "other",
    primaryUseCase: "personal_productivity",
  },
];

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: schemaError } = await supabase
  .from("workspaces")
  .select("id")
  .limit(1);
if (schemaError) {
  throw new Error(
    "The workspace schema is not available. Apply Supabase migrations before seeding demo accounts.",
    { cause: schemaError },
  );
}

const { data: usersPage, error: listError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const existingUsers = new Map(
  usersPage.users.map((user) => [user.email?.toLowerCase(), user]),
);

async function getOrCreateAuthUser(account) {
  const existing = existingUsers.get(account.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: account.fullName,
          professional_category: account.primaryRole,
        },
        app_metadata: { demo_account: true },
      },
    );
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      professional_category: account.primaryRole,
    },
    app_metadata: { demo_account: true },
  });
  if (error) throw error;
  existingUsers.set(account.email, data.user);
  return data.user;
}

const seededUsers = [];
for (const account of accounts) {
  const user = await getOrCreateAuthUser(account);
  seededUsers.push({ ...account, id: user.id });
}

const owner = seededUsers.find((account) => account.workspaceRole === "owner");
if (!owner) throw new Error("A demo workspace owner is required.");

const { data: existingWorkspace, error: workspaceReadError } = await supabase
  .from("workspaces")
  .select("id")
  .eq("slug", "work-fyi-demo")
  .maybeSingle();
if (workspaceReadError) throw workspaceReadError;

let workspaceId = existingWorkspace?.id;
if (!workspaceId) {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      name: "Work.fyi Demo Workspace",
      slug: "work-fyi-demo",
      owner_id: owner.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  workspaceId = data.id;
}

const { error: membershipsError } = await supabase
  .from("workspace_members")
  .upsert(
    seededUsers.map((account) => ({
      workspace_id: workspaceId,
      user_id: account.id,
      role: account.workspaceRole,
    })),
    { onConflict: "workspace_id,user_id" },
  );
if (membershipsError) throw membershipsError;

const { error: profilesError } = await supabase.from("profiles").upsert(
  seededUsers.map((account) => ({
    id: account.id,
    full_name: account.fullName,
    timezone: "Asia/Singapore",
    primary_role: account.primaryRole,
    primary_use_case: account.primaryUseCase,
    active_workspace_id: workspaceId,
  })),
  { onConflict: "id" },
);
if (profilesError) throw profilesError;

console.log(
  JSON.stringify(
    {
      workspace: "Work.fyi Demo Workspace",
      password,
      accounts: seededUsers.map(({ email, workspaceRole, primaryRole }) => ({
        email,
        workspaceRole,
        professionalCategory: primaryRole,
      })),
    },
    null,
    2,
  ),
);
