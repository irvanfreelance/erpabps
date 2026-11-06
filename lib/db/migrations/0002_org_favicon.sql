ALTER TABLE org_profile ADD COLUMN IF NOT EXISTS favicon_url TEXT;
COMMENT ON COLUMN org_profile.favicon_url IS 'URL ikon tab browser. Kosong = pakai logo_url.';
UPDATE org_profile SET favicon_url = logo_url WHERE favicon_url IS NULL AND logo_url IS NOT NULL;
