import { supabase } from "@/integrations/supabase/client";

export const ordersData = [
  {
    orderNumber: "138768",
    customerName: "SACI",
    deliveryDate: "2025-10-30",
    createdAt: "2025-09-03",
    status: "production",
    priority: "normal",
    notes: "REPOR ALMOX",
    items: [
      {
        itemCode: "1977",
        description: "BOLICHE, ENGRENAGEM CONICA 19D - 90MM EIXO ACIONAMENTO FUSC",
        requestedQty: 10,
        deliveredQty: 10,
        unit: "PC",
        warehouse: "11",
        sourceType: "in_stock"
      },
      {
        itemCode: "1954",
        description: "BOLICHE, ENGRENAGEM CONICA 16D - 70MM EIXO FUSO DIREITO/ESQUERDO",
        requestedQty: 10,
        deliveredQty: 11,
        unit: "PC",
        warehouse: "11",
        sourceType: "in_stock"
      }
    ]
  },
  {
    orderNumber: "138870",
    customerName: "FILIAL",
    deliveryDate: "2025-10-10",
    createdAt: "2025-09-22",
    status: "production",
    priority: "high",
    notes: "MÁQUINA ESTRAGADA",
    items: [
      { itemCode: "37515", description: "RED BOWLING, ENGRENAGEM 20 DENTES ELEVADOR (ZINCADO)", requestedQty: 3, deliveredQty: 3, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "37514", description: "RED BOWLING, EIXO INFERIOR ELEVADOR DE BOLAS (ZINCADO)", requestedQty: 3, deliveredQty: 3, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "44685", description: "RED BOWLING, ENGRENAGEM 24 DENTES ELEVADOR (ZINCADO)", requestedQty: 3, deliveredQty: 3, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "37513", description: "RED BOWLING, EIXO SUPERIOR ELEVADOR DE BOLAS (ZINCADO)", requestedQty: 3, deliveredQty: 3, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  },
  {
    orderNumber: "138986",
    customerName: "ESTOQUE TRT4",
    deliveryDate: "2025-10-17",
    createdAt: "2025-09-22",
    status: "production",
    priority: "normal",
    notes: "GUARDAR CHEGADA DE COMPONENTE",
    items: [
      { itemCode: "42500", description: "PYCPU120B, PLACA CPU TOTEM CANCELA SEM CPU119 (VERNIZ 2 FACES)", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" },
      { itemCode: "42794", description: "PYCPU117A PLACA CPU CANCELA AUTONOMA (VERNIZ 2 FACE)", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" },
      { itemCode: "5841", description: "PYSHF115, PLACA SHIFT COMUM PARA CONEXÃO HPA SEM 128K", requestedQty: 10, deliveredQty: 10, unit: "PC", warehouse: "10", sourceType: "in_stock" },
      { itemCode: "27429", description: "PYEME71, PLACA EMENDA COM CHAVE HH", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" },
      { itemCode: "56403", description: "PYEME101, PLACA EMENDA PARA INTERFACE CATRACA WENCAN / ML1", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" },
      { itemCode: "58434", description: "PYEME102, PLACA EMENDA PARA INTERFACE CANCELA TAGZD/CONTE", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" },
      { itemCode: "5759", description: "PYTHF04A, PLACA CPU CANCELA PARA ACESSO PREDIAL", requestedQty: 4, deliveredQty: 3, unit: "PC", warehouse: "10", sourceType: "production" }
    ]
  },
  {
    orderNumber: "139013",
    customerName: "HUTCHY",
    deliveryDate: "2025-10-01",
    createdAt: "2025-09-24",
    status: "production",
    priority: "normal",
    notes: "",
    items: [
      { itemCode: "24784", description: "GREEN BOWLING, CONJUNTO ROLETE DO ACELERADOR DE BOLAS", requestedQty: 5, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "2845", description: "BOLICHE, BARRA DE TRAÇÃO - MRF 06/2018", requestedQty: 3, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "29020", description: "BOLICHE, MOTOR ELEVADOR DE BOLAS DC 24V 06HZ RKM-BZ-2", requestedQty: 1, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "32335", description: "GREEN BOWLING, FUSO ESQUERDO - MRF 06/2018", requestedQty: 2, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  },
  {
    orderNumber: "139037",
    customerName: "HOSPITAL DE CARIDADE",
    deliveryDate: "2025-10-25",
    createdAt: "2025-09-25",
    status: "production",
    priority: "high",
    notes: "",
    items: [
      { itemCode: "38064", description: "CONJUNTO DISPLAY LCD 2 X 20 COM PLACA IPYEME54 MONTADA ATRÁS", requestedQty: 1, deliveredQty: 1, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  },
  {
    orderNumber: "139003",
    customerName: "CONCEBRA",
    deliveryDate: "2025-09-29",
    createdAt: "2025-09-29",
    status: "production",
    priority: "normal",
    notes: "",
    items: [
      { itemCode: "7503", description: "J-HOCKEY, ESTRUTURA DIREITA DE FIXAÇÃO DO SOLENOIDE SOLETEC", requestedQty: 1, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "7619", description: "J-H ATTACK, SUPORTE DOS TUBOS", requestedQty: 1, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  },
  {
    orderNumber: "139019",
    customerName: "CON DE ROD NOROESTE PAULISTA",
    deliveryDate: "2025-10-15",
    createdAt: "2025-09-30",
    status: "production",
    priority: "high",
    notes: "ENCOMENDAR",
    items: [
      { itemCode: "46695", description: "PMV FIXO RODOVIA, PLACA FILTRO PROT. DE SURTO 48V/12V", requestedQty: 10, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "6054", description: "LCD 2 X 16, C/ BACKLIGHT, BARRA PINO SIMPLES (WH1602L-YYH-JTK / F)", requestedQty: 10, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "out_of_stock", productionDate: "2025-10-30" },
      { itemCode: "30670", description: "PMV FIXA ROTA, PLACA LED DRIVER TPS54240", requestedQty: 10, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "23641", description: "CLUSTER 25MM P1X0B3 4X3LR-08U1AB-TO-TRZ CON FEMEA 2MM", requestedQty: 10, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "22494", description: "PYDRV19, PLACA LED DRIVER MONO MY9163SS 0.635MM 150MILS CON", requestedQty: 7, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "37158", description: "PYCPU112D, PLACA CPU PARA PAINEL PIM/ PER", requestedQty: 5, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "44254", description: "PIM 2021-06, CABO ANTENA 3G/4G ROTEADOR KEYANG", requestedQty: 3, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "44255", description: "PIM 2021-06, CABO ANTENA WIFI ROTEADOR KEYANG", requestedQty: 3, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "46698", description: "PMV FIXO RODOVIA, CABO ALIMENTACAO DC ASUS", requestedQty: 10, deliveredQty: 11, unit: "PC", warehouse: "11", sourceType: "in_stock" },
      { itemCode: "46699", description: "PMV FIXO RODOVIA, CABO RESET ASUS", requestedQty: 10, deliveredQty: 12, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  },
  {
    orderNumber: "139073",
    customerName: "PRIMUS IMPORT",
    deliveryDate: "2025-10-14",
    createdAt: "2025-09-30",
    status: "production",
    priority: "normal",
    notes: "",
    items: [
      { itemCode: "52480", description: "LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE", requestedQty: 8, deliveredQty: 4, unit: "M2", warehouse: "11", sourceType: "production", productionDate: "2025-10-06" },
      { itemCode: "52477", description: "LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE", requestedQty: 12, deliveredQty: 4, unit: "M2", warehouse: "11", sourceType: "production", productionDate: "2025-10-06" },
      { itemCode: "52477", description: "LAMINADO M423 10,00 BR 3,08 X 1,25M 30V FU FL1A, S/ LINHAS, C/ ALVE", requestedQty: 25, deliveredQty: 25, unit: "M2", warehouse: "11", sourceType: "in_stock", productionDate: "2025-10-06" }
    ]
  },
  {
    orderNumber: "139085",
    customerName: "AGROTURISMO",
    deliveryDate: "2025-10-10",
    createdAt: "2025-09-30",
    status: "production",
    priority: "normal",
    notes: "COMPRA",
    items: [
      { itemCode: "37716", description: "CANCELA MOTOR AC 2020-05, TUBO DA HASTE BRAÇO FIXO RETANGUL", requestedQty: 1, deliveredQty: 1, unit: "PC", warehouse: "11", sourceType: "in_stock" }
    ]
  }
];

export async function importOrders(userId: string) {
  try {
    let successCount = 0;
    let errorCount = 0;
    
    for (const orderData of ordersData) {
      try {
        // Inserir pedido
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            order_number: orderData.orderNumber,
            customer_name: orderData.customerName,
            delivery_address: orderData.customerName,
            status: 'almox_ssm', // Status inicial: Aguardando Almox SSM
            priority: orderData.priority,
            order_type: 'reposicao_estoque', // Tipo padrão para pedidos importados
            delivery_date: orderData.deliveryDate,
            notes: orderData.notes,
            totvs_order_number: orderData.orderNumber,
            created_at: orderData.createdAt
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Erro ao inserir pedido ${orderData.orderNumber}:`, orderError);
          errorCount++;
          continue;
        }

        // Inserir itens
        const itemsToInsert = orderData.items.map(item => ({
          user_id: userId,
          order_id: order.id,
          item_code: item.itemCode,
          item_description: item.description,
          requested_quantity: item.requestedQty,
          delivered_quantity: item.deliveredQty,
          unit: item.unit,
          warehouse: item.warehouse,
          delivery_date: orderData.deliveryDate,
          item_source_type: item.sourceType,
          production_estimated_date: (item as any).productionDate || null,
          created_at: orderData.createdAt
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error(`Erro ao inserir itens do pedido ${orderData.orderNumber}:`, itemsError);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Erro ao processar pedido ${orderData.orderNumber}:`, err);
        errorCount++;
      }
    }

    return { successCount, errorCount, total: ordersData.length };
  } catch (error) {
    console.error('Erro ao importar pedidos:', error);
    throw error;
  }
}
