-- Inserir documentos RAG de Scripts de Atendimento
INSERT INTO ai_knowledge_base (title, content, category, agent_type, document_type, keywords, is_active, priority) VALUES
('Script - Pedido em Produção', 
'Quando o pedido está em produção, informar de forma conversacional:
- O pedido está sendo preparado pela equipe
- Mencionar a previsão de entrega
- Perguntar se quer ser avisado quando sair

Exemplo BOM: "Oi! Seu pedido #140045 tá em produção agora, a galera tá caprichando! Previsão de ficar pronto é dia 05/01. Quer que te avise quando sair?"

Exemplo RUIM: "📦 Pedido: 140045 📍 Status: Em Produção 📅 Previsão: 05/01"',
'atendimento', 'customer', 'script', ARRAY['produção', 'fabricando', 'preparando', 'status', 'em produção'], true, 10),

('Script - Pedido em Trânsito',
'Quando o pedido está em trânsito, informar:
- Que já saiu e está a caminho
- Fornecer código de rastreio se disponível
- Informar transportadora
- Dar previsão de chegada

Exemplo BOM: "Opa! Boa notícia! Seu pedido já tá viajando! Saiu com a Jadlog e o código pra rastrear é ABC123. Deve chegar aí por volta de sexta!"

Exemplo RUIM: "Seu pedido está em trânsito. Transportadora: Jadlog. Código: ABC123."',
'atendimento', 'customer', 'script', ARRAY['trânsito', 'enviado', 'caminho', 'rastreio', 'transportadora', 'entrega'], true, 10),

('Script - Pedido Entregue',
'Quando o pedido foi entregue:
- Confirmar que chegou
- Perguntar se está tudo certo
- Oferecer ajuda se precisar

Exemplo BOM: "E aí! Vi aqui que seu pedido foi entregue! Chegou tudo certinho? Me conta se precisar de algo!"',
'atendimento', 'customer', 'script', ARRAY['entregue', 'chegou', 'recebeu', 'delivered'], true, 10),

('Script - Aguardando Faturamento',
'Quando o pedido está aguardando faturamento:
- Explicar que está na fila para nota fiscal
- Mencionar que logo será enviado
- Dar previsão se possível

Exemplo BOM: "Olha só, seu pedido tá certinho e entrando na fila pra emissão da nota fiscal. Assim que sair, já vai pra expedição! Deve ser rapidinho."',
'atendimento', 'customer', 'script', ARRAY['faturamento', 'nota fiscal', 'NF', 'faturar'], true, 10),

('Script - Pedido em Separação',
'Quando o pedido está sendo separado:
- Explicar que estão preparando os itens
- Indicar que está próximo de sair
- Manter tom otimista

Exemplo BOM: "Opa! Tão separando seu pedido agora - juntando tudinho pra embalar. Logo logo sai!"',
'atendimento', 'customer', 'script', ARRAY['separação', 'separando', 'almoxarifado', 'preparando'], true, 10);

-- Inserir FAQs
INSERT INTO ai_knowledge_base (title, content, category, agent_type, document_type, keywords, is_active, priority) VALUES
('FAQ - Onde está meu pedido',
'Quando cliente pergunta onde está o pedido:
1. Se TEM os dados: informar status atual diretamente
2. Se NÃO TEM: pedir número do pedido de forma natural

Exemplo BOM (com dados): "Achei aqui! Seu pedido #140045 tá em produção, previsão de sair dia 05/01. Era esse?"
Exemplo BOM (sem dados): "Oi! Me passa o número do pedido pra eu localizar rapidinho?"

NUNCA diga "vou verificar" se já tem os dados na mão!',
'faq', 'customer', 'procedimento', ARRAY['onde', 'cadê', 'localizar', 'rastrear', 'status'], true, 15),

('FAQ - Quando chega meu pedido',
'Quando cliente quer saber previsão de chegada:
- Informar data de entrega prevista
- Mencionar transportadora se souber
- Explicar que pode variar um pouco

Exemplo BOM: "A previsão tá pra dia 10/01! Vai com a Jadlog. Às vezes pode variar 1-2 dias dependendo da região, mas tá no caminho!"',
'faq', 'customer', 'procedimento', ARRAY['quando', 'chega', 'previsão', 'prazo', 'entrega', 'data'], true, 15),

('FAQ - Como rastrear meu pedido',
'Formas de rastrear o pedido:
1. Pelo código de rastreio no site da transportadora
2. Perguntando aqui pelo WhatsApp
3. Pelo email de notificação

Se não tiver código ainda: explicar que é gerado quando a transportadora coleta.

Exemplo BOM: "O código de rastreio é ABC123! Você consegue acompanhar no site da Jadlog. Quer que eu te mande o link?"',
'faq', 'customer', 'procedimento', ARRAY['rastrear', 'rastreio', 'acompanhar', 'código', 'tracking'], true, 15),

('FAQ - Pedido atrasado',
'Quando cliente reclama de atraso:
1. Pedir desculpas genuínas
2. Verificar status real
3. Explicar motivo se conhecido
4. Dar nova previsão realista

Exemplo BOM: "Poxa, desculpa pelo atraso! Vi aqui que teve um problema na transportadora. Nova previsão é dia 15/01. Vou acompanhar de perto pra você!"

NUNCA prometer prazos impossíveis. Ser honesto.',
'faq', 'customer', 'procedimento', ARRAY['atrasado', 'atraso', 'demora', 'não chegou', 'demorou'], true, 15),

('FAQ - Mudar endereço de entrega',
'Se cliente quer mudar endereço:
- Se ainda não saiu: pode ser possível alterar
- Se já está em trânsito: mais difícil, precisa contatar transportadora
- Sempre verificar viabilidade antes de prometer

Exemplo BOM: "Deixa eu ver... se ainda não saiu pra entrega, dá pra mudar sim! Me passa o novo endereço completo que eu verifico com a equipe."',
'faq', 'customer', 'procedimento', ARRAY['endereço', 'mudar', 'alterar', 'trocar', 'entregar em outro'], true, 12);

-- Inserir Procedimentos de Ocorrências
INSERT INTO ai_knowledge_base (title, content, category, agent_type, document_type, occurrence_type, keywords, is_active, priority) VALUES
('Procedimento - Produto Danificado',
'Se cliente reportar produto danificado:
1. Expressar preocupação genuína
2. Solicitar foto do produto e da embalagem
3. Pedir número da nota fiscal
4. Informar prazo de análise (até 48h úteis)
5. Registrar ocorrência

Exemplo BOM: "Putz, que chato isso! Me manda uma foto do produto e da embalagem? E se tiver a nota fiscal também. Vou abrir uma ocorrência e te retorno em até 48h, tá?"

Escalar para humano se dano muito grave.',
'ocorrencia', 'customer', 'procedimento', 'avaria', ARRAY['danificado', 'quebrado', 'avariado', 'estragado', 'amassado', 'trincado'], true, 20),

('Procedimento - Produto Errado',
'Se cliente recebeu produto errado:
1. Pedir desculpas pelo erro
2. Confirmar o que foi recebido vs pedido
3. Solicitar foto do produto recebido
4. Explicar processo de troca

Exemplo BOM: "Caramba, desculpa pelo erro! Me conta: o que você pediu e o que chegou? Manda uma foto do produto que você recebeu pra gente resolver isso rapidinho."',
'ocorrencia', 'customer', 'procedimento', 'extravio', ARRAY['errado', 'trocado', 'outro', 'diferente', 'não era esse', 'veio errado'], true, 20),

('Procedimento - Falta de Produto',
'Se cliente diz que faltou item no pedido:
1. Verificar nota fiscal vs itens recebidos
2. Pedir foto da embalagem (se foi violada)
3. Conferir se não está em outra caixa/volume
4. Abrir ocorrência de falta

Exemplo BOM: "Opa, deixa eu entender: qual item faltou? Consegue ver quantos volumes vieram? Às vezes vem em caixas separadas. Se conferiu tudo e falta mesmo, me avisa que a gente resolve!"',
'ocorrencia', 'customer', 'procedimento', 'extravio', ARRAY['faltou', 'falta', 'não veio', 'incompleto', 'faltando'], true, 20),

('Procedimento - Não Recebi',
'Se cliente diz que não recebeu mas consta entregue:
1. Verificar endereço de entrega
2. Perguntar se outra pessoa pode ter recebido
3. Verificar com portaria/vizinhos
4. Se confirmar que não chegou, abrir ocorrência

Exemplo BOM: "Hmm, aqui consta como entregue. Consegue verificar se alguém recebeu pra você? Porteiro, familiar... Se ninguém recebeu, me avisa que vou abrir uma ocorrência com a transportadora!"',
'ocorrencia', 'customer', 'procedimento', 'extravio', ARRAY['não recebi', 'não chegou', 'consta entregue', 'nunca chegou', 'não foi entregue'], true, 20);

-- Inserir Transportadoras e Tonalidade
INSERT INTO ai_knowledge_base (title, content, category, agent_type, document_type, keywords, is_active, priority) VALUES
('Transportadora - Correios',
'Correios:
- Rastreamento: www.correios.com.br/rastreamento
- Prazo padrão: 5-15 dias úteis dependendo da região
- Entrega apenas em dias úteis
- Se não tiver ninguém: fica disponível na agência mais próxima por 7 dias
- Código de rastreio começa com letras (ex: AA123456789BR)

Para rastrear: acessar site dos Correios e inserir código.',
'transportadora', 'general', 'procedimento', ARRAY['correios', 'sedex', 'pac', 'encomenda'], true, 8),

('Transportadora - Jadlog',
'Jadlog:
- Rastreamento: www.jadlog.com.br
- Prazo: 3-7 dias úteis
- Entrega de segunda a sábado
- Duas tentativas de entrega, depois vai pra agência
- Código numérico

Boa transportadora para cargas médias.',
'transportadora', 'general', 'procedimento', ARRAY['jadlog'], true, 8),

('Tonalidade - Boas Notícias',
'Quando comunicar boas notícias (pedido saiu, foi entregue, etc):
- Tom alegre e entusiasmado
- Usar expressões como "Boa notícia!", "Olha só!", "Que bom!"
- Um emoji positivo
- Manter energia positiva

Exemplo: "Olha só que beleza! Seu pedido acabou de sair pra entrega!"',
'tonalidade', 'general', 'procedimento', ARRAY['positivo', 'entregue', 'saiu', 'pronto'], true, 5),

('Tonalidade - Problemas e Atrasos',
'Quando comunicar problemas ou atrasos:
- Demonstrar empatia genuína
- Pedir desculpas sinceras
- Explicar situação honestamente
- Oferecer solução ou próximos passos

Exemplo: "Poxa, desculpa por isso! Sei que você tá esperando. Deixa eu ver o que aconteceu e te falo a real situação, ok?"

NUNCA: minimizar o problema ou parecer indiferente.',
'tonalidade', 'general', 'procedimento', ARRAY['problema', 'atraso', 'erro', 'reclamação'], true, 5),

('Tonalidade - Dúvidas Simples',
'Para dúvidas simples do dia a dia:
- Tom amigável e casual
- Resposta direta mas simpática
- Verificar se ajudou

Exemplo: "Claro! O rastreio é ABC123. Qualquer coisa, tô por aqui!"',
'tonalidade', 'general', 'procedimento', ARRAY['dúvida', 'pergunta', 'informação'], true, 5);