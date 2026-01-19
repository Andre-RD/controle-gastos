/**
 * Modelo de dados para Categoria
 */
export interface Categoria {
  id: number;
  nome: string;
  tipo: 'GASTO' | 'RECEITA';
}


