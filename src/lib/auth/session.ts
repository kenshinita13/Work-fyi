import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getVerifiedClaims = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return data.claims;
});

export const getWorkspaceContext = cache(async () => {
  const claims = await getVerifiedClaims();

  if (!claims) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, active_workspace_id, primary_role, primary_use_case",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  let membershipQuery = supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", claims.sub);

  if (profile?.active_workspace_id) {
    membershipQuery = membershipQuery.eq(
      "workspace_id",
      profile.active_workspace_id,
    );
  }

  let { data: membership } = await membershipQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership && profile?.active_workspace_id) {
    const fallback = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", claims.sub)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    membership = fallback.data;
  }

  if (!membership) {
    return {
      claims,
      profile,
      membership: null,
      workspace: null,
    };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", membership.workspace_id)
    .single();

  return { claims, profile, membership, workspace };
});
