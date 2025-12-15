-- Expandir tabela customer_contacts com campos de endereço e tracking
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS last_order_id uuid REFERENCES orders(id);
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS orders_count integer DEFAULT 0;

-- Adicionar índice para busca por documento (evitar duplicados)
CREATE INDEX IF NOT EXISTS idx_customer_contacts_document ON customer_contacts(customer_document);

-- Atualizar RLS para permitir que usuários autenticados vejam e gerenciem clientes
DROP POLICY IF EXISTS "Super Admins can manage customer contacts" ON customer_contacts;

CREATE POLICY "Authenticated users can view customer contacts"
ON customer_contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customer contacts"
ON customer_contacts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer contacts"
ON customer_contacts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can delete customer contacts"
ON customer_contacts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));