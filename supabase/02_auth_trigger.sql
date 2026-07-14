-- =============================================================================
-- Ceverse — Supabase Auth → public.users sync
-- Run AFTER ceverse_schema.sql (or after `npx prisma db push`)
-- SQL Editor in Supabase Dashboard → paste → Run
-- =============================================================================

-- Keep public.users.id aligned with auth.users.id (UUID)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_role_enum "UserRole";
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Ceverse user'
  );

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'CREATOR');

  -- Map only allowed signup roles (never elevate to admin via metadata)
  IF v_role NOT IN (
    'CREATOR', 'OPERATOR', 'MANUFACTURER', 'DESIGNER', 'PACKAGING_PARTNER',
    'PHOTOGRAPHER', 'LAWYER', 'MARKETING_AGENCY', 'WAREHOUSE', 'INVESTOR'
  ) THEN
    v_role := 'CREATOR';
  END IF;

  v_role_enum := v_role::"UserRole";

  INSERT INTO public.users (
    id, email, name, image, role, "emailVerified", "trustScore", "isActive", "createdAt", "updatedAt", version
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
    v_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    v_role_enum,
    (NEW.email_confirmed_at IS NOT NULL),
    50,
    true,
    now(),
    now(),
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    image = COALESCE(EXCLUDED.image, public.users.image),
    "emailVerified" = public.users."emailVerified" OR EXCLUDED."emailVerified",
    "updatedAt" = now();

  -- Bootstrap profile by role
  IF v_role = 'CREATOR' THEN
    INSERT INTO public.creator_profiles (
      id, "userId", "displayName", "audienceSize", "engagementRate",
      "socialLinks", industries, "preferredCategories", "preferredPartnerships",
      languages, "portfolioUrls", "pastLaunches", "verificationStatus",
      "createdAt", "updatedAt", version
    )
    VALUES (
      gen_random_uuid()::text, NEW.id, v_name, 0, 0,
      '{}'::jsonb, '{}', '{}', '{}', '{}', '{}', '[]'::jsonb, 'UNVERIFIED',
      now(), now(), 1
    )
    ON CONFLICT ("userId") DO NOTHING;
  ELSE
    INSERT INTO public.operator_profiles (
      id, "userId", "companyName", "companyType", "certifications",
      "regionsServed", "hasWarehousing", "hasFulfillment", "qualityCerts",
      "portfolioUrls", "caseStudies", "pastLaunches", industries, categories,
      "successRate", "verificationStatus", "createdAt", "updatedAt", version
    )
    VALUES (
      gen_random_uuid()::text, NEW.id, v_name, v_role_enum, '{}',
      '{}', false, false, '{}', '{}', '[]'::jsonb, '[]'::jsonb, '{}', '{}',
      0, 'UNVERIFIED', now(), now(), 1
    )
    ON CONFLICT ("userId") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Optional: keep email verified flag in sync
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    UPDATE public.users
    SET "emailVerified" = true, "updatedAt" = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_confirmed();
