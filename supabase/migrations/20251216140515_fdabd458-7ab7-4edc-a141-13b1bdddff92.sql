-- Índices para acelerar consultas de histórico por order_id
CREATE INDEX IF NOT EXISTS idx_order_history_order_id 
ON order_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_comments_order_id 
ON order_comments(order_id);

CREATE INDEX IF NOT EXISTS idx_order_changes_order_id 
ON order_changes(order_id);

CREATE INDEX IF NOT EXISTS idx_order_item_history_order_id 
ON order_item_history(order_id);

CREATE INDEX IF NOT EXISTS idx_mention_tags_comment_id 
ON mention_tags(comment_id);