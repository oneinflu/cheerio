-- Clear old stages and workflows associations to reset to the new standard
DELETE FROM lead_stage_workflows;
DELETE FROM lead_stages;

-- Re-establish the standardized leads funnel for the main team
INSERT INTO lead_stages (id, name, color, position, team_id, is_closed) VALUES
(gen_random_uuid(), 'N2 Fresh Leads', '#3b82f6', 1, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'N2 Minus', '#10b981', 2, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'N2 Plus', '#f59e0b', 3, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'N3 Interested', '#8b5cf6', 4, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'N3 Plus', '#6366f1', 5, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'N3 Minus', '#ec4899', 6, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), false),
(gen_random_uuid(), 'Lost', '#ef4444', 7, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), true),
(gen_random_uuid(), 'Converted', '#22c55e', 8, (SELECT id FROM teams ORDER BY created_at ASC LIMIT 1), true);

-- Re-link all existing workflows to the first stage (N2 Fresh Leads) to ensure visibility
INSERT INTO lead_stage_workflows (stage_id, workflow_id, position)
SELECT (SELECT id FROM lead_stages WHERE name = 'N2 Fresh Leads' LIMIT 1), id, ROW_NUMBER() OVER (ORDER BY created_at ASC)
FROM workflows
ON CONFLICT (stage_id, workflow_id) DO NOTHING;
