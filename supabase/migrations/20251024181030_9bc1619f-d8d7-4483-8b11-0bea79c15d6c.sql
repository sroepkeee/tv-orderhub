-- Inserir transportadoras faltantes com emails de cotação
INSERT INTO public.carriers (name, email, quote_email, contact_person, service_states, is_active)
VALUES
  ('000005 - BENTO BRASIL TR', 'comercial@bentobrasil.com.br', 'comercial@bentobrasil.com.br', 'Comercial', ARRAY[]::text[], true),
  ('000016 - TNT', 'marcos.garske.osv@fedex.com', 'marcos.garske.osv@fedex.com', 'Marcos Garske', ARRAY[]::text[], true),
  ('000071 - JLS LOGISTICA E', 'joaoluiz@jlslogistica.com.br', 'joaoluiz@jlslogistica.com.br', 'João Luiz', ARRAY[]::text[], true),
  ('000079 - TRANSPORTES BIANO', 'joaopedro@transportesbiano.com.br', 'joaopedro@transportesbiano.com.br', 'João Pedro', ARRAY[]::text[], true),
  ('000099 - TRINDADE & CIA LTDA - ME', 'mercadotrindade06@hotmail.com', 'mercadotrindade06@hotmail.com', 'Mercado', ARRAY[]::text[], true),
  ('000102 - TW TRANSPORTES', 'stc.operacional@twtransportes.com.br', 'stc.operacional@twtransportes.com.br', 'Operacional', ARRAY[]::text[], true),
  ('000179 - BAUER TRANSPORTES', 'santacruzdosul@bauerexpress.com.br', 'santacruzdosul@bauerexpress.com.br', 'Santa Cruz do Sul', ARRAY[]::text[], true),
  ('000203 - TRANSPORTES STUMPF LTDA', 'marcos@transportesstumpf.com.br', 'marcos@transportesstumpf.com.br', 'Marcos', ARRAY[]::text[], true),
  ('000217 - JEFERSON MAIA TRANSPORTES', 'Jmrtransportes.rs@hotmail.com', 'Jmrtransportes.rs@hotmail.com', 'Jeferson', ARRAY[]::text[], true),
  ('000222 - HSUL TRANSPORTES', 'blasiohickmann@hotmail.com', 'blasiohickmann@hotmail.com', 'Blasio', ARRAY[]::text[], true),
  ('AMG & JVA', 'comercial1@amglog.com.br', 'comercial1@amglog.com.br', 'Comercial', ARRAY[]::text[], true),
  ('CADORE TRANSPORTES', 'cachoeirinha@cadore.com.br', 'cachoeirinha@cadore.com.br', 'Cachoeirinha', ARRAY[]::text[], true),
  ('COOPEX', 'operacao.scs@coopex.com.br', 'operacao.scs@coopex.com.br', 'Operação SCS', ARRAY[]::text[], true),
  ('GOLDEN', 'janine@goldenexp.com.br', 'janine@goldenexp.com.br', 'Janine', ARRAY[]::text[], true);