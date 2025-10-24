/**
 * Extrai cidade do endereço completo
 * Ex: "Rua Principal, 123, SANTA CRUZ DO SUL/RS" → "SANTA CRUZ DO SUL"
 */
export function extractCity(address?: string): string {
  if (!address) return '';
  
  // Tentar encontrar padrão "CIDADE/UF"
  const matchWithSlash = address.match(/([^,/]+)\/[A-Z]{2}/);
  if (matchWithSlash) {
    return matchWithSlash[1].trim();
  }
  
  // Tentar encontrar padrão ", CIDADE - UF"
  const matchWithDash = address.match(/,\s*([^,-]+)\s*-\s*[A-Z]{2}/);
  if (matchWithDash) {
    return matchWithDash[1].trim();
  }
  
  // Pegar última parte antes do estado ou final
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  
  return '';
}

/**
 * Extrai UF do endereço
 * Ex: "Rua Principal, 123, SANTA CRUZ DO SUL/RS" → "RS"
 */
export function extractState(address?: string): string {
  if (!address) return '';
  
  // Tentar encontrar padrão "/UF" (mais comum)
  const matchWithSlash = address.match(/\/([A-Z]{2})(?:\s|$|,)/);
  if (matchWithSlash) {
    return matchWithSlash[1];
  }
  
  // Tentar encontrar padrão "- UF"
  const matchWithDash = address.match(/-\s*([A-Z]{2})(?:\s|$|,)/);
  if (matchWithDash) {
    return matchWithDash[1];
  }
  
  // Tentar encontrar qualquer sigla de estado no final
  const matchEnd = address.match(/\b([A-Z]{2})$/);
  if (matchEnd) {
    return matchEnd[1];
  }
  
  return '';
}
