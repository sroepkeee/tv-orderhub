-- Add second test phone number to the active AI agent config
UPDATE ai_agent_config 
SET test_phones = ARRAY['5551999050190', '5551981414600']
WHERE id = 'c5096701-1581-4040-9c0b-bbb49184596f';