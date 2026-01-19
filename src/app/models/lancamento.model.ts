/**
 * Modelo de dados para Lançamento Financeiro
 */
export interface Lancamento {
  id: number;
  data: Date;
  descricao: string;
  valor: number;
  tipo: 'GASTO' | 'RECEITA';
  categoria: string;
  pago?: boolean;
}

