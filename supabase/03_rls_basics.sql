-- =============================================================================
-- Ceverse — basic Row Level Security (defense in depth)
-- App still authorizes via Prisma + service paths; RLS protects direct PostgREST.
-- Service role / Prisma (database password) bypasses RLS by design.
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own row
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Marketplace profiles are readable by signed-in users
CREATE POLICY creator_profiles_read ON public.creator_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY operator_profiles_read ON public.operator_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY creator_profiles_write_own ON public.creator_profiles
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

CREATE POLICY operator_profiles_write_own ON public.operator_profiles
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

-- Proposals: sender or recipient
CREATE POLICY proposals_participant ON public.proposals
  FOR SELECT TO authenticated
  USING ("senderId" = auth.uid() OR "recipientId" = auth.uid());

-- Deals: members only
CREATE POLICY deals_member_select ON public.deals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deal_members m
      WHERE m."dealId" = deals.id AND m."userId" = auth.uid()
    )
  );

CREATE POLICY deal_members_self ON public.deal_members
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid() OR EXISTS (
    SELECT 1 FROM public.deal_members m2
    WHERE m2."dealId" = deal_members."dealId" AND m2."userId" = auth.uid()
  ));

-- Notifications own only
CREATE POLICY notifications_own ON public.notifications
  FOR ALL TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());
