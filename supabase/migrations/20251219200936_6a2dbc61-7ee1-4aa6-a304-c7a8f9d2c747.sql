-- Insert test manager number
INSERT INTO management_report_recipients (user_id, whatsapp, is_active, report_types) 
VALUES ('1f550d76-7586-41e1-a6e8-335b09b97299', '555199050190', true, ARRAY['daily', 'alerts'])
ON CONFLICT DO NOTHING;