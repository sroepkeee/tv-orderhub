-- Limpar apenas os dados de teste anteriores a 12/10/2025
DELETE FROM delivery_date_changes WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_comments WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_completion_notes WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM orders WHERE created_at < '2025-10-12';