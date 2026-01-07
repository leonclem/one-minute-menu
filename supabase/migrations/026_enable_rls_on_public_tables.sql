-- Migration: Enable RLS on public tables and define security policies
-- Based on Supabase Security Advisor recommendations

-- 1. reserved_slugs
ALTER TABLE reserved_slugs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Anyone can view reserved slugs to check availability
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reserved_slugs' AND policyname = 'Public can view reserved slugs') THEN
        CREATE POLICY "Public can view reserved slugs" ON reserved_slugs
            FOR SELECT USING (true);
    END IF;

    -- Only admins can manage reserved slugs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reserved_slugs' AND policyname = 'Admins can manage reserved slugs') THEN
        CREATE POLICY "Admins can manage reserved slugs" ON reserved_slugs
            FOR ALL TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
            WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;
END $$;

-- 2. platform_analytics
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Only admins can view platform analytics
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_analytics' AND policyname = 'Admins can view platform analytics') THEN
        CREATE POLICY "Admins can view platform analytics" ON platform_analytics
            FOR SELECT TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;

    -- Anyone can insert/update platform analytics (to allow server-side tracking)
    -- This is safe because they cannot SELECT the data they insert
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_analytics' AND policyname = 'Anyone can insert platform analytics') THEN
        CREATE POLICY "Anyone can insert platform analytics" ON platform_analytics
            FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_analytics' AND policyname = 'Anyone can update platform analytics') THEN
        CREATE POLICY "Anyone can update platform analytics" ON platform_analytics
            FOR UPDATE USING (true) WITH CHECK (true);
    END IF;

    -- Only admins can delete platform analytics
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'platform_analytics' AND policyname = 'Admins can delete platform analytics') THEN
        CREATE POLICY "Admins can delete platform analytics" ON platform_analytics
            FOR DELETE TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;
END $$;

-- 3. geographic_usage
ALTER TABLE geographic_usage ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Only admins can view geographic usage
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'geographic_usage' AND policyname = 'Admins can view geographic usage') THEN
        CREATE POLICY "Admins can view geographic usage" ON geographic_usage
            FOR SELECT TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;

    -- Anyone can insert/update geographic usage (to allow server-side tracking)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'geographic_usage' AND policyname = 'Anyone can insert geographic usage') THEN
        CREATE POLICY "Anyone can insert geographic usage" ON geographic_usage
            FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'geographic_usage' AND policyname = 'Anyone can update geographic usage') THEN
        CREATE POLICY "Anyone can update geographic usage" ON geographic_usage
            FOR UPDATE USING (true) WITH CHECK (true);
    END IF;

    -- Only admins can delete geographic usage
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'geographic_usage' AND policyname = 'Admins can delete geographic usage') THEN
        CREATE POLICY "Admins can delete geographic usage" ON geographic_usage
            FOR DELETE TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;
END $$;

-- 4. abuse_reports
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Anyone can submit abuse reports
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abuse_reports' AND policyname = 'Public can submit abuse reports') THEN
        CREATE POLICY "Public can submit abuse reports" ON abuse_reports
            FOR INSERT WITH CHECK (true);
    END IF;

    -- Only admins can view/manage abuse reports
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abuse_reports' AND policyname = 'Admins can manage abuse reports') THEN
        CREATE POLICY "Admins can manage abuse reports" ON abuse_reports
            FOR ALL TO authenticated
            USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
            WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
    END IF;
END $$;
