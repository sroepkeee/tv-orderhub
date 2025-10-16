import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { addDays, isWeekend, parse, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula a data após N dias úteis (excluindo sábados e domingos)
 * @param startDate - Data inicial em formato DD/MM/YYYY ou Date
 * @param businessDays - Número de dias úteis a adicionar
 * @returns Data final em formato DD/MM/YYYY
 */
export function addBusinessDays(startDate: string | Date, businessDays: number): string {
  let currentDate: Date;
  
  // Converter string DD/MM/YYYY para Date
  if (typeof startDate === 'string') {
    currentDate = parse(startDate, 'dd/MM/yyyy', new Date());
  } else {
    currentDate = startDate;
  }
  
  let daysAdded = 0;
  
  while (daysAdded < businessDays) {
    currentDate = addDays(currentDate, 1);
    
    // Contar apenas se não for fim de semana
    if (!isWeekend(currentDate)) {
      daysAdded++;
    }
  }
  
  // Retornar em formato DD/MM/YYYY
  return format(currentDate, 'dd/MM/yyyy');
}
