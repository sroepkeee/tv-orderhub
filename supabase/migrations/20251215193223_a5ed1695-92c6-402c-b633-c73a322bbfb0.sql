-- Insert 14 compliance rules for AI agent
INSERT INTO public.ai_rules (policy, rule_description, rule, rule_risk, action, is_active) VALUES

-- 1️⃣ Linguagem da Internet
('Desvio de conduta', 
 'Detecta gírias e abreviações comuns da internet', 
 'sqn, pq, aff, oxe, eita, vc, tb, blz, kk, rs, kkk, haha, mano, cara, tipo assim',
 'low', 'log', true),

-- 2️⃣ Conteúdo ilegal ou suspeito de fraude
('Desvio de conduta', 
 'Identifica menções a armas, munição, drogas, golpes, documentos falsos', 
 'arma, armas, munição, droga, drogas, golpe, documento falso, roubo, assalto, tráfico, contrabando, lavagem',
 'high', 'block', true),

-- 3️⃣ Uso intenso de sinais gráficos
('Desvio de conduta', 
 'Excesso de pontuação enfática (!!!, ???, ?!?)', 
 '!!!, ???, ?!?, !!??, !?!?, ?????, !!!!!',
 'low', 'log', true),

-- 4️⃣ Xingar ou usar ironia direta
('Desvio de conduta', 
 'Detecta xingamentos diretos ao interlocutor', 
 'você é um lixo, inútil, idiota, burro, incompetente, imbecil, retardado, otário',
 'moderate', 'warn', true),

-- 5️⃣ Venda feita para o dia seguinte
('PEDIDO FECHADO', 
 'Frases que indicam pedido confirmado/inserido/fechado', 
 'pedido inserido, venda fechada, pedido confirmado, pedido registrado, venda realizada',
 'low', 'log', true),

-- 6️⃣ Confirmação de pedido
('PEDIDO FECHADO', 
 'Confirmação explícita de pedido realizado', 
 'pedido realizado, compra confirmada, pedido efetuado, compra efetuada, ordem gerada',
 'low', 'log', true),

-- 7️⃣ Pedido cancelado
('PEDIDO CANCELADO', 
 'Detecção de cancelamento de pedido', 
 'cancelar pedido, pedido cancelado, cancela o pedido, desistir da compra, cancelamento, estorno',
 'moderate', 'warn', true),

-- 8️⃣ Solicitação de desconto
('NEGOCIAÇÃO', 
 'Palavras relacionadas a desconto ou negociação de preço', 
 'desconto, abaixa, faz por menos, preço menor, baixar o valor, condição especial, melhor preço',
 'low', 'log', true),

-- 9️⃣ Reclamação ou insatisfação
('RECLAMAÇÃO', 
 'Expressões de frustração, insatisfação ou problema', 
 'insatisfeito, frustrado, problema, reclamação, péssimo atendimento, decepcionado, absurdo',
 'moderate', 'warn', true),

-- 🔟 Ameaça ou intimidação
('VIOLÊNCIA', 
 'Ameaças explícitas ou implícitas', 
 'vou processar, vai se arrepender, ameaça, vou denunciar, procon, reclame aqui, advogado, processo',
 'high', 'block', true),

-- 1️⃣1️⃣ Linguagem imprópria geral
('CONDUTA', 
 'Palavrões genéricos não direcionados', 
 'merda, porra, caralho, droga, inferno, desgraça, maldito',
 'moderate', 'warn', true),

-- 1️⃣2️⃣ Pedido urgente
('PRIORIDADE', 
 'Indicações de urgência no pedido', 
 'urgente, agora, pra hoje, imediato, não pode esperar, preciso já, emergência, máxima urgência',
 'low', 'log', true),

-- 1️⃣3️⃣ Tentativa de burlar processo
('DESVIO DE PROCESSO', 
 'Frases que indicam bypass, jeitinho, fora do sistema', 
 'fora do sistema, sem nota, por fora, dá um jeito, jeitinho, informal, sem registro, off',
 'high', 'block', true),

-- 1️⃣4️⃣ Conteúdo suspeito genérico
('ALERTA', 
 'Padrões amplos de comportamento suspeito', 
 'comportamento suspeito, estranho, anormal, incomum, irregular, atípico',
 'moderate', 'warn', true);