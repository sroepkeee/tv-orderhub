-- Limpar dados de teste anteriores a 12/10/2025
DELETE FROM delivery_date_changes WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_comments WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_completion_notes WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_history WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-10-12');
DELETE FROM orders WHERE created_at < '2025-10-12';

-- Pedido 138768 - SACI
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '138768', 'SACI', 'SACI', 'production', 'normal', 'standard', '2025-10-30', '2025-09-03', 'REPOR ALMOX');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '1977', 'BOLICHE, ENGRENAGEM CONICA 19D - 90MM EIXO ACIONAMENTO FUSC', 10, 10, 'PC', '11', '2025-10-30', 'in_stock', '2025-09-03' FROM orders WHERE order_number = '138768';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '1954', 'BOLICHE, ENGRENAGEM CONICA 16D - 70MM EIXO FUSO DIREITO/ESQUERDO', 10, 11, 'PC', '11', '2025-10-30', 'in_stock', '2025-09-03' FROM orders WHERE order_number = '138768';

-- Pedido 138870 - FILIAL
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '138870', 'FILIAL', 'FILIAL', 'production', 'high', 'standard', '2025-10-10', '2025-09-22', 'MÁQUINA ESTRAGADA');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '37515', 'RED BOWLING, ENGRENAGEM 20 DENTES ELEVADOR (ZINCADO)', 3, 3, 'PC', '11', '2025-10-10', 'in_stock', '2025-09-22' FROM orders WHERE order_number = '138870';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '37514', 'RED BOWLING, EIXO INFERIOR ELEVADOR DE BOLAS (ZINCADO)', 3, 3, 'PC', '11', '2025-10-10', 'in_stock', '2025-09-22' FROM orders WHERE order_number = '138870';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '44685', 'RED BOWLING, ENGRENAGEM 24 DENTES ELEVADOR (ZINCADO)', 3, 3, 'PC', '11', '2025-10-10', 'in_stock', '2025-09-22' FROM orders WHERE order_number = '138870';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '37513', 'RED BOWLING, EIXO SUPERIOR ELEVADOR DE BOLAS (ZINCADO)', 3, 3, 'PC', '11', '2025-10-10', 'in_stock', '2025-09-22' FROM orders WHERE order_number = '138870';

-- Pedido 138986 - ESTOQUE TRT4
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '138986', 'ESTOQUE TRT4', 'ESTOQUE TRT4', 'production', 'normal', 'standard', '2025-10-17', '2025-09-22', 'GUARDAR CHEGADA DE COMPONENTE');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '42500', 'PYCPU120B, PLACA CPU TOTEM CANCELA SEM CPU119 (VERNIZ 2 FACES)', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '42794', 'PYCPU117A PLACA CPU CANCELA AUTONOMA (VERNIZ 2 FACE)', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '5841', 'PYSHF115, PLACA SHIFT COMUM PARA CONEXÃO HPA SEM 128K', 10, 10, 'PC', '10', '2025-10-17', 'in_stock', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '27429', 'PYEME71, PLACA EMENDA COM CHAVE HH', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '56403', 'PYEME101, PLACA EMENDA PARA INTERFACE CATRACA WENCAN / ML1', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '58434', 'PYEME102, PLACA EMENDA PARA INTERFACE CANCELA TAGZD/CONTE', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '5759', 'PYTHF04A, PLACA CPU CANCELA PARA ACESSO PREDIAL', 4, 3, 'PC', '10', '2025-10-17', 'production', '2025-09-22' FROM orders WHERE order_number = '138986';

-- Pedido 139013 - HUTCHY
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139013', 'HUTCHY', 'HUTCHY', 'production', 'normal', 'standard', '2025-10-01', '2025-09-24', '');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '24784', 'GREEN BOWLING, CONJUNTO ROLETE DO ACELERADOR DE BOLAS', 5, 11, 'PC', '11', '2025-10-01', 'in_stock', '2025-09-24' FROM orders WHERE order_number = '139013';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '2845', 'BOLICHE, BARRA DE TRAÇÃO - MRF 06/2018', 3, 11, 'PC', '11', '2025-10-01', 'in_stock', '2025-09-24' FROM orders WHERE order_number = '139013';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '29020', 'BOLICHE, MOTOR ELEVADOR DE BOLAS DC 24V 06HZ RKM-BZ-2', 1, 11, 'PC', '11', '2025-10-01', 'in_stock', '2025-09-24' FROM orders WHERE order_number = '139013';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '32335', 'GREEN BOWLING, FUSO ESQUERDO - MRF 06/2018', 2, 11, 'PC', '11', '2025-10-01', 'in_stock', '2025-09-24' FROM orders WHERE order_number = '139013';

-- Pedido 139037 - HOSPITAL DE CARIDADE
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139037', 'HOSPITAL DE CARIDADE', 'HOSPITAL DE CARIDADE', 'production', 'high', 'standard', '2025-10-25', '2025-09-25', '');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '38064', 'CONJUNTO DISPLAY LCD 2 X 20 COM PLACA IPYEME54 MONTADA ATRÁS', 1, 1, 'PC', '11', '2025-10-25', 'in_stock', '2025-09-25' FROM orders WHERE order_number = '139037';

-- Pedido 139003 - CONCEBRA
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139003', 'CONCEBRA', 'CONCEBRA', 'production', 'normal', 'standard', '2025-09-29', '2025-09-29', '');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '7503', 'J-HOCKEY, ESTRUTURA DIREITA DE FIXAÇÃO DO SOLENOIDE SOLETEC', 1, 11, 'PC', '11', '2025-09-29', 'in_stock', '2025-09-29' FROM orders WHERE order_number = '139003';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '7619', 'J-H ATTACK, SUPORTE DOS TUBOS', 1, 11, 'PC', '11', '2025-09-29', 'in_stock', '2025-09-29' FROM orders WHERE order_number = '139003';

-- Pedido 139019 - CON DE ROD NOROESTE PAULISTA
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139019', 'CON DE ROD NOROESTE PAULISTA', 'CON DE ROD NOROESTE PAULISTA', 'production', 'high', 'standard', '2025-10-15', '2025-09-30', 'ENCOMENDAR');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '46695', 'PMV FIXO RODOVIA, PLACA FILTRO PROT. DE SURTO 48V/12V', 10, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, production_estimated_date, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '6054', 'LCD 2 X 16, C/ BACKLIGHT, BARRA PINO SIMPLES (WH1602L-YYH-JTK / F)', 10, 11, 'PC', '11', '2025-10-15', 'out_of_stock', '2025-10-30', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '30670', 'PMV FIXA ROTA, PLACA LED DRIVER TPS54240', 10, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '23641', 'CLUSTER 25MM P1X0B3 4X3LR-08U1AB-TO-TRZ CON FEMEA 2MM', 10, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '22494', 'PYDRV19, PLACA LED DRIVER MONO MY9163SS 0.635MM 150MILS CON', 7, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '37158', 'PYCPU112D, PLACA CPU PARA PAINEL PIM/ PER', 5, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '44254', 'PIM 2021-06, CABO ANTENA 3G/4G ROTEADOR KEYANG', 3, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '44255', 'PIM 2021-06, CABO ANTENA WIFI ROTEADOR KEYANG', 3, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '46698', 'PMV FIXO RODOVIA, CABO ALIMENTACAO DC ASUS', 10, 11, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '46699', 'PMV FIXO RODOVIA, CABO RESET ASUS', 10, 12, 'PC', '11', '2025-10-15', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139019';

-- Pedido 139073 - PRIMUS IMPORT
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139073', 'PRIMUS IMPORT', 'PRIMUS IMPORT', 'completed', 'normal', 'standard', '2025-10-14', '2025-09-30', '');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, production_estimated_date, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '52480', 'LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE', 8, 4, 'M2', '11', '2025-10-14', 'production', '2025-10-06', '2025-09-30' FROM orders WHERE order_number = '139073';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, production_estimated_date, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '52477', 'LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE', 12, 4, 'M2', '11', '2025-10-14', 'production', '2025-10-06', '2025-09-30' FROM orders WHERE order_number = '139073';

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, production_estimated_date, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '52477', 'LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE', 25, 25, 'M2', '11', '2025-10-14', 'in_stock', '2025-10-06', '2025-09-30' FROM orders WHERE order_number = '139073';

-- Pedido 139085 - AGROTURISMO
INSERT INTO orders (user_id, order_number, customer_name, delivery_address, status, priority, order_type, delivery_date, created_at, notes)
VALUES ('2424275f-bcc4-4e19-8891-53e9824e1d50', '139085', 'AGROTURISMO', 'AGROTURISMO', 'production', 'normal', 'standard', '2025-10-10', '2025-09-30', 'COMPRA');

INSERT INTO order_items (user_id, order_id, item_code, item_description, requested_quantity, delivered_quantity, unit, warehouse, delivery_date, item_source_type, created_at)
SELECT '2424275f-bcc4-4e19-8891-53e9824e1d50', id, '37716', 'CANCELA MOTOR AC 2020-05, TUBO DA HASTE BRAÇO FIXO RETANGUL', 1, 1, 'PC', '11', '2025-10-10', 'in_stock', '2025-09-30' FROM orders WHERE order_number = '139085';