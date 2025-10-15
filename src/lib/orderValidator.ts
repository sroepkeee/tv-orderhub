import { z } from 'zod';

export const orderSchema = z.object({
  orderNumber: z.string().min(1, "Número do pedido é obrigatório"),
  customerName: z.string().min(3, "Nome do cliente deve ter no mínimo 3 caracteres"),
  deliveryAddress: z.string().min(5, "Endereço de entrega é obrigatório"),
  deliveryDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data de entrega deve estar no formato DD/MM/AAAA"),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  municipality: z.string().optional()
});

export const itemSchema = z.object({
  itemCode: z.string().min(1, "Código do item é obrigatório"),
  description: z.string().min(3, "Descrição é obrigatória"),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unit: z.string().min(1, "Unidade é obrigatória"),
  warehouse: z.string().min(1, "Armazém é obrigatório")
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOrder(data: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  try {
    orderSchema.parse(data.orderInfo);
  } catch (error: any) {
    result.isValid = false;
    result.errors.push(...error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`));
  }
  
  // Validar itens
  if (!data.items || data.items.length === 0) {
    result.isValid = false;
    result.errors.push("Pedido deve ter pelo menos 1 item");
  } else {
    data.items.forEach((item: any, index: number) => {
      try {
        itemSchema.parse(item);
      } catch (error: any) {
        result.isValid = false;
        error.errors.forEach((e: any) => {
          result.errors.push(`Item ${index + 1} - ${e.path.join('.')}: ${e.message}`);
        });
      }
    });
  }
  
  // Warnings
  if (!data.orderInfo.carrier) {
    result.warnings.push("Transportadora não informada");
  }
  
  if (!data.orderInfo.freightType) {
    result.warnings.push("Tipo de frete não informado");
  }

  if (!data.orderInfo.municipality) {
    result.warnings.push("Município não informado");
  }
  
  return result;
}

export function validatePdfOrder(data: any): ValidationResult {
  const result = validateOrder(data);
  
  // Validações específicas para PDF TOTVS
  if (!data.orderInfo.operationCode) {
    result.warnings.push("Código de operação não identificado no PDF");
  }
  
  if (!data.orderInfo.executiveName) {
    result.warnings.push("Nome do executivo não identificado");
  }
  
  if (!data.orderInfo.customerDocument) {
    result.warnings.push("CNPJ/CPF do cliente não identificado");
  }
  
  // Verificar itens sem valores financeiros
  const itemsWithoutPrice = data.items.filter((i: any) => !i.unitPrice || i.unitPrice === 0);
  if (itemsWithoutPrice.length > 0) {
    result.warnings.push(`${itemsWithoutPrice.length} item(ns) sem valor unitário`);
  }
  
  // Qualidade da extração
  if (data.quality) {
    const qualityPercent = (data.quality.extractedFields / data.quality.totalFields) * 100;
    if (qualityPercent < 70) {
      result.warnings.push(`Qualidade da extração: ${qualityPercent.toFixed(0)}% - revise os dados`);
    }
  }
  
  return result;
}
