import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import * as XLSX from 'xlsx';

import { Lancamento } from './models/lancamento.model';
import { Categoria } from './models/categoria.model';

/**
 * Componente principal da aplicação
 * Gerencia o controle financeiro pessoal
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Controle Financeiro';

  // Formulário de lançamento
  lancamentoForm: FormGroup;

  // Lista de categorias pré-definidas
  categorias: Categoria[] = [
    { id: 1, nome: 'Alimentação', tipo: 'GASTO' },
    { id: 2, nome: 'Transporte', tipo: 'GASTO' },
    { id: 3, nome: 'Moradia', tipo: 'GASTO' },
    { id: 4, nome: 'Saúde', tipo: 'GASTO' },
    { id: 5, nome: 'Educação', tipo: 'GASTO' },
    { id: 6, nome: 'Lazer', tipo: 'GASTO' },
    { id: 7, nome: 'Débitos CNPJ', tipo: 'GASTO' },
    { id: 8, nome: 'Outros Gastos', tipo: 'GASTO' },
    { id: 9, nome: 'Salário', tipo: 'RECEITA' },
    { id: 10, nome: 'Freelance', tipo: 'RECEITA' },
    { id: 11, nome: 'Investimentos', tipo: 'RECEITA' },
    { id: 12, nome: 'Outras Receitas', tipo: 'RECEITA' }
  ];

  // Categorias filtradas conforme o tipo selecionado
  categoriasFiltradas: Categoria[] = [];

  // Lista de lançamentos
  lancamentos: Lancamento[] = [];

  // DataSource para as tabelas
  dataSource = new MatTableDataSource<Lancamento>([]);
  dataSourceReceitas = new MatTableDataSource<Lancamento>([]);
  dataSourceGastos = new MatTableDataSource<Lancamento>([]);

  // Colunas da tabela
  displayedColumns: string[] = ['data', 'descricao', 'categoria', 'valor', 'status', 'acoes'];
  
  // Controle de edição
  lancamentoEditando: Lancamento | null = null;
  modoEdicao: boolean = false;

  // Totais calculados
  totalReceitas: number = 0;
  totalGastos: number = 0;
  saldoFinal: number = 0;
  
  // Totais de status de pagamento
  gastosPagos: number = 0;
  gastosNaoPagos: number = 0;
  gastosPendentesDia15: number = 0; // Gastos que vencem antes do dia 31 (dia 1-30)
  gastosPendentesDia31: number = 0; // Gastos que vencem no dia 31
  receitasPagas: number = 0;

  // Contador para IDs únicos
  private idCounter: number = 1;

  // Histórico por mês/ano
  historicoMensal: { [key: string]: Lancamento[] } = {};
  mesesDisponiveis: string[] = [];
  mesSelecionado: string = '';

  constructor(private fb: FormBuilder) {
    this.lancamentoForm = this.fb.group({
      data: [new Date(), Validators.required],
      descricao: ['', Validators.required],
      valor: ['', [Validators.required, Validators.min(0.01)]],
      tipo: ['GASTO', Validators.required],
      categoria: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Carregar histórico mensal
    this.carregarHistoricoMensal();

    // Carregar dados do mês atual
    this.carregarMesAtual();

    // Filtrar categorias iniciais
    this.filtrarCategorias();

    // Observar mudanças no tipo para filtrar categorias
    this.lancamentoForm.get('tipo')?.valueChanges.subscribe(() => {
      this.filtrarCategorias();
      // Limpar categoria selecionada quando o tipo mudar
      this.lancamentoForm.patchValue({ categoria: '' });
    });

    // Atualizar totais
    this.calcularTotais();
  }

  /**
   * Filtra as categorias baseado no tipo selecionado (GASTO ou RECEITA)
   */
  filtrarCategorias(): void {
    const tipoSelecionado = this.lancamentoForm.get('tipo')?.value;
    this.categoriasFiltradas = this.categorias.filter(cat => cat.tipo === tipoSelecionado);
  }

  /**
   * Adiciona um novo lançamento financeiro ou atualiza um existente
   */
  adicionarLancamento(): void {
    if (this.lancamentoForm.valid) {
      const formValue = this.lancamentoForm.value;
      
      if (this.modoEdicao && this.lancamentoEditando) {
        // Modo edição - atualizar lançamento existente
        const index = this.lancamentos.findIndex(l => l.id === this.lancamentoEditando!.id);
        if (index !== -1) {
          const lancamentoAtualizado: Lancamento = {
            ...this.lancamentoEditando,
            data: new Date(formValue.data),
            descricao: formValue.descricao.trim(),
            valor: parseFloat(formValue.valor),
            tipo: formValue.tipo,
            categoria: formValue.categoria
          };
          
          this.lancamentos[index] = lancamentoAtualizado;
          this.dataSource.data = this.ordenarPorData(this.lancamentos);
          
          // Atualizar no histórico mensal
          const chaveMes = this.obterChaveMes(lancamentoAtualizado.data);
          if (this.historicoMensal[chaveMes]) {
            const indexHistorico = this.historicoMensal[chaveMes].findIndex(l => l.id === lancamentoAtualizado.id);
            if (indexHistorico !== -1) {
              this.historicoMensal[chaveMes][indexHistorico] = lancamentoAtualizado;
            }
          }
          
          // Atualizar tabelas separadas
          this.atualizarTabelasSeparadas();
          
          // Salvar no LocalStorage
          this.salvarHistoricoMensalLocalStorage();
          
          // Recalcular totais
          this.calcularTotais();
          
          // Cancelar edição
          this.cancelarEdicao();
        }
      } else {
        // Modo adição - criar novo lançamento
        const novoLancamento: Lancamento = {
          id: this.idCounter++,
          data: new Date(formValue.data),
          descricao: formValue.descricao.trim(),
          valor: parseFloat(formValue.valor),
          tipo: formValue.tipo,
          categoria: formValue.categoria,
          pago: false
        };

        this.lancamentos.push(novoLancamento);
        this.dataSource.data = this.ordenarPorData(this.lancamentos);
        
        // Atualizar tabelas separadas
        this.atualizarTabelasSeparadas();
        
        // Salvar no histórico mensal
        this.salvarNoHistoricoMensal(novoLancamento);

        // Recalcular totais
        this.calcularTotais();

        // Resetar formulário
        this.lancamentoForm.reset({
          data: new Date(),
          tipo: 'GASTO',
          categoria: ''
        });
        this.filtrarCategorias();
      }
    } else {
      // Marcar todos os campos como touched para exibir erros
      Object.keys(this.lancamentoForm.controls).forEach(key => {
        this.lancamentoForm.get(key)?.markAsTouched();
      });
    }
  }

  /**
   * Edita um lançamento existente
   */
  editarLancamento(lancamento: Lancamento): void {
    this.lancamentoEditando = lancamento;
    this.modoEdicao = true;
    
    // Preencher formulário com dados do lançamento
    this.lancamentoForm.patchValue({
      data: new Date(lancamento.data),
      descricao: lancamento.descricao,
      valor: lancamento.valor,
      tipo: lancamento.tipo,
      categoria: lancamento.categoria
    });
    
    // Filtrar categorias conforme o tipo
    this.filtrarCategorias();
    
    // Scroll para o formulário
    setTimeout(() => {
      const formElement = document.querySelector('.formulario-cadastro');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  /**
   * Cancela a edição
   */
  cancelarEdicao(): void {
    this.modoEdicao = false;
    this.lancamentoEditando = null;
    this.lancamentoForm.reset({
      data: new Date(),
      tipo: 'GASTO',
      categoria: ''
    });
    this.filtrarCategorias();
  }

  /**
   * Exclui um lançamento
   */
  excluirLancamento(lancamento: Lancamento): void {
    if (confirm(`Deseja realmente excluir o lançamento "${lancamento.descricao}"?`)) {
      // Remover da lista de lançamentos
      const index = this.lancamentos.findIndex(l => l.id === lancamento.id);
      if (index !== -1) {
        this.lancamentos.splice(index, 1);
        this.dataSource.data = this.ordenarPorData(this.lancamentos);
      }
      
      // Remover do histórico mensal
      const chaveMes = this.obterChaveMes(lancamento.data);
      if (this.historicoMensal[chaveMes]) {
        const indexHistorico = this.historicoMensal[chaveMes].findIndex(l => l.id === lancamento.id);
        if (indexHistorico !== -1) {
          this.historicoMensal[chaveMes].splice(indexHistorico, 1);
          
          // Se o mês ficou vazio, remover da lista de meses disponíveis
          if (this.historicoMensal[chaveMes].length === 0) {
            delete this.historicoMensal[chaveMes];
            this.atualizarMesesDisponiveis();
          }
        }
      }
      
      // Atualizar tabelas separadas
      this.atualizarTabelasSeparadas();
      
      // Salvar no LocalStorage
      this.salvarHistoricoMensalLocalStorage();
      
      // Recalcular totais
      this.calcularTotais();
      
      // Se estava editando este lançamento, cancelar edição
      if (this.lancamentoEditando && this.lancamentoEditando.id === lancamento.id) {
        this.cancelarEdicao();
      }
    }
  }

  /**
   * Marca um lançamento como pago ou não pago
   */
  marcarComoPago(lancamento: Lancamento): void {
      const index = this.lancamentos.findIndex(l => l.id === lancamento.id);
    if (index !== -1) {
      this.lancamentos[index].pago = !this.lancamentos[index].pago;
      this.dataSource.data = this.ordenarPorData(this.lancamentos);
      
      // Atualizar no histórico mensal
      const chaveMes = this.obterChaveMes(lancamento.data);
      if (this.historicoMensal[chaveMes]) {
        const indexHistorico = this.historicoMensal[chaveMes].findIndex(l => l.id === lancamento.id);
        if (indexHistorico !== -1) {
          this.historicoMensal[chaveMes][indexHistorico].pago = this.lancamentos[index].pago;
        }
      }
      
      // Atualizar tabelas separadas
      this.atualizarTabelasSeparadas();
      
      // Salvar no LocalStorage
      this.salvarHistoricoMensalLocalStorage();
      
      // Recalcular totais (incluindo status de pagamento)
      this.calcularTotais();
    }
  }

  /**
   * Obtém o último dia de um mês/ano
   * @param ano Ano
   * @param mes Mês (0-11, formato JavaScript)
   */
  obterUltimoDiaDoMes(ano: number, mes: number): number {
    // Usar o mês seguinte com dia 0 para obter o último dia do mês atual
    return new Date(ano, mes + 1, 0).getDate();
  }

  /**
   * Ajusta a data para o próximo mês, considerando o último dia quando necessário
   */
  ajustarDataParaProximoMes(data: Date): Date {
    const dataAtual = new Date(data);
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const dia = dataAtual.getDate();
    
    // Calcular próximo mês
    let proximoAno = ano;
    let proximoMes = mes + 1;
    
    // Se passar de dezembro, vai para janeiro do próximo ano
    if (proximoMes > 11) {
      proximoMes = 0;
      proximoAno++;
    }
    
    // Obter último dia do próximo mês (mes já está no formato 0-11)
    const ultimoDiaProximoMes = this.obterUltimoDiaDoMes(proximoAno, proximoMes);
    
    // Se o dia atual é maior que o último dia do próximo mês, usar o último dia
    const novoDia = dia > ultimoDiaProximoMes ? ultimoDiaProximoMes : dia;
    
    return new Date(proximoAno, proximoMes, novoDia);
  }

  /**
   * Duplica todos os lançamentos do mês atual para o próximo mês
   */
  duplicarMesParaProximo(): void {
    if (!this.mesSelecionado || this.lancamentos.length === 0) {
      alert('Não há lançamentos para duplicar neste mês.');
      return;
    }

    if (!confirm(`Deseja duplicar todos os ${this.lancamentos.length} lançamento(s) deste mês para o próximo mês?`)) {
      return;
    }

    const lancamentosDuplicados: Lancamento[] = [];
    
    // Calcular chave do próximo mês a partir do mês selecionado
    const [anoAtual, mesAtual] = this.mesSelecionado.split('-').map(Number);
    let proximoAno = anoAtual;
    let proximoMes = mesAtual + 1;
    
    // Se passar de dezembro, vai para janeiro do próximo ano
    if (proximoMes > 12) {
      proximoMes = 1;
      proximoAno++;
    }
    
    const chaveProximoMes = `${proximoAno}-${String(proximoMes).padStart(2, '0')}`;

    // Duplicar cada lançamento
    this.lancamentos.forEach(lancamento => {
      const novaData = this.ajustarDataParaProximoMes(lancamento.data);
      
      const lancamentoDuplicado: Lancamento = {
        id: this.idCounter++,
        data: novaData,
        descricao: lancamento.descricao,
        valor: lancamento.valor,
        tipo: lancamento.tipo,
        categoria: lancamento.categoria,
        pago: false // Sempre começar como não pago
      };

      lancamentosDuplicados.push(lancamentoDuplicado);
    });

    // Adicionar ao histórico mensal do próximo mês
    if (!this.historicoMensal[chaveProximoMes]) {
      this.historicoMensal[chaveProximoMes] = [];
    }
    
    this.historicoMensal[chaveProximoMes].push(...lancamentosDuplicados);
    
    // Atualizar lista de meses disponíveis
    this.atualizarMesesDisponiveis();
    
    // Salvar no LocalStorage
    this.salvarHistoricoMensalLocalStorage();

    alert(`${lancamentosDuplicados.length} lançamento(s) duplicado(s) com sucesso para ${this.formatarNomeMes(chaveProximoMes)}!`);
  }

  /**
   * Duplica um lançamento
   */
  duplicarLancamento(lancamento: Lancamento): void {
    // Criar cópia do lançamento com novo ID
    const lancamentoDuplicado: Lancamento = {
      id: this.idCounter++,
      data: new Date(lancamento.data),
      descricao: `${lancamento.descricao} (cópia)`,
      valor: lancamento.valor,
      tipo: lancamento.tipo,
      categoria: lancamento.categoria,
      pago: false
    };

    // Adicionar à lista de lançamentos
    this.lancamentos.push(lancamentoDuplicado);
    this.dataSource.data = this.ordenarPorData(this.lancamentos);
    
    // Atualizar tabelas separadas
    this.atualizarTabelasSeparadas();
    
    // Salvar no histórico mensal
    this.salvarNoHistoricoMensal(lancamentoDuplicado);

    // Recalcular totais
    this.calcularTotais();
  }

  /**
   * Verifica se um lançamento está vencido (data passou e não foi pago)
   */
  estaVencido(lancamento: Lancamento): boolean {
    if (lancamento.pago === true) {
      return false; // Se já foi pago, não está vencido
    }
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
    
    const dataVencimento = new Date(lancamento.data);
    dataVencimento.setHours(0, 0, 0, 0);
    
    return dataVencimento < hoje;
  }

  /**
   * Ordena lançamentos por data (mais antigo primeiro)
   */
  ordenarPorData(lancamentos: Lancamento[]): Lancamento[] {
    return [...lancamentos].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }

  /**
   * Atualiza as tabelas separadas de receitas e gastos
   */
  atualizarTabelasSeparadas(): void {
    const receitas = this.ordenarPorData(
      this.lancamentos.filter(l => l.tipo === 'RECEITA')
    );
    
    const gastos = this.ordenarPorData(
      this.lancamentos.filter(l => l.tipo === 'GASTO')
    );
    
    this.dataSourceReceitas.data = receitas;
    this.dataSourceGastos.data = gastos;
  }

  /**
   * Calcula os totais de receitas, gastos e saldo final
   */
  calcularTotais(): void {
    this.totalReceitas = this.lancamentos
      .filter(l => l.tipo === 'RECEITA')
      .reduce((sum, l) => sum + l.valor, 0);

    this.totalGastos = this.lancamentos
      .filter(l => l.tipo === 'GASTO')
      .reduce((sum, l) => sum + l.valor, 0);

    this.saldoFinal = this.totalReceitas - this.totalGastos;
    
    // Calcular totais de status de pagamento
    this.gastosPagos = this.lancamentos
      .filter(l => l.tipo === 'GASTO' && l.pago === true)
      .reduce((sum, l) => sum + l.valor, 0);
    
    this.gastosNaoPagos = this.lancamentos
      .filter(l => l.tipo === 'GASTO' && (l.pago === false || l.pago === undefined))
      .reduce((sum, l) => sum + l.valor, 0);
    
    // Calcular gastos pendentes divididos por dia de vencimento
    this.gastosPendentesDia15 = this.lancamentos
      .filter(l => {
        if (l.tipo !== 'GASTO' || l.pago === true) return false;
        const dia = new Date(l.data).getDate();
        return dia >= 1 && dia <= 30; // Vencem do dia 1 ao 30
      })
      .reduce((sum, l) => sum + l.valor, 0);
    
    this.gastosPendentesDia31 = this.lancamentos
      .filter(l => {
        if (l.tipo !== 'GASTO' || l.pago === true) return false;
        const dia = new Date(l.data).getDate();
        return dia === 31; // Vencem no dia 31
      })
      .reduce((sum, l) => sum + l.valor, 0);
    
    this.receitasPagas = this.lancamentos
      .filter(l => l.tipo === 'RECEITA' && l.pago === true)
      .reduce((sum, l) => sum + l.valor, 0);
  }

  /**
   * Formata o valor para exibição em BRL
   */
  formatarValor(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  /**
   * Formata a data para exibição
   */
  formatarData(data: Date): string {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(data));
  }

  /**
   * Formata a data para exibir apenas o dia (para relatórios mensais)
   */
  formatarDia(data: Date): string {
    const dia = new Date(data).getDate();
    return String(dia).padStart(2, '0');
  }

  /**
   * Obtém a chave do mês/ano a partir de uma data
   */
  obterChaveMes(data: Date): string {
    const date = new Date(data);
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${ano}-${mes}`;
  }

  /**
   * Obtém a chave do mês atual
   */
  obterChaveMesAtual(): string {
    return this.obterChaveMes(new Date());
  }

  /**
   * Obtém o nome formatado do mês/ano
   */
  formatarNomeMes(chaveMes: string): string {
    const [ano, mes] = chaveMes.split('-');
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[parseInt(mes) - 1]}/${ano}`;
  }

  /**
   * Salva um lançamento no histórico mensal
   */
  private salvarNoHistoricoMensal(lancamento: Lancamento): void {
    const chaveMes = this.obterChaveMes(lancamento.data);
    
    if (!this.historicoMensal[chaveMes]) {
      this.historicoMensal[chaveMes] = [];
    }
    
    this.historicoMensal[chaveMes].push(lancamento);
    
    // Atualizar lista de meses disponíveis
    this.atualizarMesesDisponiveis();
    
    // Salvar no LocalStorage
    this.salvarHistoricoMensalLocalStorage();
  }

  /**
   * Atualiza a lista de meses disponíveis
   */
  private atualizarMesesDisponiveis(): void {
    this.mesesDisponiveis = Object.keys(this.historicoMensal)
      .sort()
      .reverse(); // Mais recente primeiro
  }

  /**
   * Carrega o mês selecionado
   */
  carregarMes(mes: string): void {
    this.mesSelecionado = mes;
    if (this.historicoMensal[mes]) {
      this.lancamentos = this.historicoMensal[mes].map(l => ({
        ...l,
        data: new Date(l.data)
      }));
      this.dataSource.data = this.ordenarPorData(this.lancamentos);
      this.atualizarTabelasSeparadas();
      this.calcularTotais();
    } else {
      this.lancamentos = [];
      this.dataSource.data = [];
      this.dataSourceReceitas.data = [];
      this.dataSourceGastos.data = [];
      this.calcularTotais();
    }
  }

  /**
   * Carrega o mês atual
   */
  carregarMesAtual(): void {
    const mesAtual = this.obterChaveMes(new Date());
    this.mesSelecionado = mesAtual;
    
    if (this.historicoMensal[mesAtual]) {
      this.lancamentos = this.historicoMensal[mesAtual].map(l => ({
        ...l,
        data: new Date(l.data)
      }));
    } else {
      this.lancamentos = [];
      this.historicoMensal[mesAtual] = [];
    }
    
    this.dataSource.data = this.ordenarPorData(this.lancamentos);
    this.atualizarTabelasSeparadas();
    this.atualizarMesesDisponiveis();
    
    // Garantir que o mês atual esteja na lista
    if (!this.mesesDisponiveis.includes(mesAtual)) {
      this.mesesDisponiveis.unshift(mesAtual);
    }
  }

  /**
   * Exporta os lançamentos para Excel
   */
  exportarExcel(): void {
    // Preparar dados para exportação
    const dadosExportacao = this.lancamentos.map(lancamento => ({
      'Data': this.formatarData(lancamento.data),
      'Descrição': lancamento.descricao,
      'Tipo': lancamento.tipo,
      'Categoria': lancamento.categoria,
      'Valor': lancamento.valor
    }));

    // Criar worksheet
    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);

    // Criar workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');

    // Gerar arquivo Excel
    const nomeArquivo = this.mesSelecionado 
      ? `controle-financeiro-${this.mesSelecionado}.xlsx`
      : 'controle-financeiro.xlsx';
    XLSX.writeFile(workbook, nomeArquivo);
  }

  /**
   * Exporta relatório mensal em JSON
   */
  exportarRelatorioMensalJSON(): void {
    if (!this.mesSelecionado || !this.historicoMensal[this.mesSelecionado]) {
      alert('Nenhum mês selecionado ou sem dados para exportar.');
      return;
    }

    const dados = {
      mes: this.mesSelecionado,
      nomeMes: this.formatarNomeMes(this.mesSelecionado),
      lancamentos: this.historicoMensal[this.mesSelecionado],
      totais: {
        receitas: this.totalReceitas,
        gastos: this.totalGastos,
        saldo: this.saldoFinal
      },
      dataExportacao: new Date().toISOString()
    };

    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-financeiro-${this.mesSelecionado}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importa relatório mensal de arquivo JSON
   */
  importarRelatorioMensalJSON(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const dados = JSON.parse(e.target.result);
        
        if (!dados.mes || !dados.lancamentos) {
          alert('Arquivo JSON inválido. Formato esperado: { mes, lancamentos, ... }');
          return;
        }

        // Converter datas de string para Date
        const lancamentos: Lancamento[] = dados.lancamentos.map((l: any) => ({
          ...l,
          data: new Date(l.data),
          pago: l.pago !== undefined ? l.pago : false
        }));

        // Adicionar ao histórico
        this.historicoMensal[dados.mes] = lancamentos;
        this.atualizarMesesDisponiveis();
        this.salvarHistoricoMensalLocalStorage();

        // Carregar o mês importado
        this.carregarMes(dados.mes);

        alert(`Relatório de ${dados.nomeMes || dados.mes} importado com sucesso!`);
        
        // Limpar input
        event.target.value = '';
      } catch (error) {
        console.error('Erro ao importar JSON:', error);
        alert('Erro ao importar arquivo JSON. Verifique se o arquivo está no formato correto.');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Importa relatório mensal de arquivo Excel
   */
  importarRelatorioMensalExcel(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ler a primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converter para JSON
        const dadosExcel = XLSX.utils.sheet_to_json(worksheet);
        
        if (!dadosExcel || dadosExcel.length === 0) {
          alert('Arquivo Excel vazio ou sem dados.');
          return;
        }

        // Converter dados do Excel para lançamentos
        const lancamentos: Lancamento[] = [];
        let maxId = 0;
        
        // Encontrar o maior ID existente
        Object.values(this.historicoMensal).forEach(lancamentosMes => {
          lancamentosMes.forEach(l => {
            if (l.id > maxId) maxId = l.id;
          });
        });
        
        dadosExcel.forEach((row: any, index: number) => {
          try {
            // Mapear colunas do Excel (pode variar)
            const dataStr = row['Data'] || row['data'] || row['DATA'];
            const descricao = row['Descrição'] || row['descricao'] || row['DESCRIÇÃO'] || row['Descricao'];
            const tipo = row['Tipo'] || row['tipo'] || row['TIPO'];
            const categoria = row['Categoria'] || row['categoria'] || row['CATEGORIA'];
            const valor = row['Valor'] || row['valor'] || row['VALOR'];

            if (!dataStr || !descricao || !tipo || !categoria || valor === undefined) {
              console.warn(`Linha ${index + 2} ignorada: dados incompletos`, row);
              return;
            }

            // Converter data
            let data: Date;
            if (typeof dataStr === 'string') {
              // Tentar parsear data no formato brasileiro (DD/MM/YYYY ou DD-MM-YYYY)
              const partes = dataStr.split(/[\/\-]/);
              if (partes.length === 3) {
                // Formato DD/MM/YYYY ou DD-MM-YYYY
                const dia = parseInt(partes[0]);
                const mes = parseInt(partes[1]) - 1;
                const ano = parseInt(partes[2]);
                data = new Date(ano, mes, dia);
              } else {
                // Tentar parsear como ISO ou formato padrão
                data = new Date(dataStr);
              }
            } else if (typeof dataStr === 'number') {
              // Data serial do Excel (número de dias desde 1900-01-01)
              // Excel usa 1 de janeiro de 1900 como base
              const excelEpoch = new Date(1899, 11, 30);
              data = new Date(excelEpoch.getTime() + dataStr * 24 * 60 * 60 * 1000);
            } else {
              data = new Date(dataStr);
            }

            if (isNaN(data.getTime())) {
              console.warn(`Linha ${index + 2} ignorada: data inválida`, dataStr);
              return;
            }

            // Validar tipo
            if (tipo !== 'GASTO' && tipo !== 'RECEITA') {
              console.warn(`Linha ${index + 2} ignorada: tipo inválido (deve ser GASTO ou RECEITA)`, tipo);
              return;
            }

            // Converter valor
            const valorNum = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^\d,.-]/g, '').replace(',', '.'));

            if (isNaN(valorNum) || valorNum <= 0) {
              console.warn(`Linha ${index + 2} ignorada: valor inválido`, valor);
              return;
            }

            const lancamento: Lancamento = {
              id: ++maxId,
              data: data,
              descricao: String(descricao).trim(),
              valor: valorNum,
              tipo: tipo as 'GASTO' | 'RECEITA',
              categoria: String(categoria).trim(),
              pago: false
            };

            lancamentos.push(lancamento);
          } catch (error) {
            console.error(`Erro ao processar linha ${index + 2}:`, error);
          }
        });

        if (lancamentos.length === 0) {
          alert('Nenhum lançamento válido encontrado no arquivo Excel.');
          return;
        }

        // Organizar por mês
        const lancamentosPorMes: { [key: string]: Lancamento[] } = {};
        lancamentos.forEach(lancamento => {
          const chaveMes = this.obterChaveMes(lancamento.data);
          if (!lancamentosPorMes[chaveMes]) {
            lancamentosPorMes[chaveMes] = [];
          }
          lancamentosPorMes[chaveMes].push(lancamento);
        });

        // Adicionar ao histórico
        Object.keys(lancamentosPorMes).forEach(mes => {
          if (this.historicoMensal[mes]) {
            // Mesclar com dados existentes
            this.historicoMensal[mes] = [...this.historicoMensal[mes], ...lancamentosPorMes[mes]];
          } else {
            this.historicoMensal[mes] = lancamentosPorMes[mes];
          }
        });

        // Atualizar contador de IDs
        this.idCounter = maxId + 1;

        this.atualizarMesesDisponiveis();
        this.salvarHistoricoMensalLocalStorage();

        // Carregar o primeiro mês importado (ou o mais recente)
        const mesesImportados = Object.keys(lancamentosPorMes).sort().reverse();
        if (mesesImportados.length > 0) {
          this.carregarMes(mesesImportados[0]);
        }

        alert(`${lancamentos.length} lançamento(s) importado(s) com sucesso de ${mesesImportados.length} mês(es)!`);
        
        // Limpar input
        event.target.value = '';
      } catch (error) {
        console.error('Erro ao importar Excel:', error);
        alert('Erro ao importar arquivo Excel. Verifique se o arquivo está no formato correto.\n\nFormato esperado:\n- Colunas: Data, Descrição, Tipo, Categoria, Valor\n- Tipo deve ser GASTO ou RECEITA');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /**
   * Exporta histórico completo em JSON
   */
  exportarHistoricoCompletoJSON(): void {
    const dados = {
      historico: this.historicoMensal,
      meses: this.mesesDisponiveis,
      dataExportacao: new Date().toISOString()
    };

    const json = JSON.stringify(dados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-financeiro-completo-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Salva o histórico mensal no LocalStorage
   */
  private salvarHistoricoMensalLocalStorage(): void {
    try {
      // Calcular o maior ID para manter o contador
      let maxId = 0;
      Object.values(this.historicoMensal).forEach(lancamentos => {
        lancamentos.forEach(l => {
          if (l.id > maxId) maxId = l.id;
        });
      });
      this.idCounter = maxId + 1;

      const dados = {
        historicoMensal: this.historicoMensal,
        idCounter: this.idCounter
      };
      localStorage.setItem('controleFinanceiroHistorico', JSON.stringify(dados));
    } catch (error) {
      console.error('Erro ao salvar histórico no LocalStorage:', error);
    }
  }

  /**
   * Carrega o histórico mensal do LocalStorage
   */
  private carregarHistoricoMensal(): void {
    try {
      const dadosSalvos = localStorage.getItem('controleFinanceiroHistorico');
      if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        
        // Converter datas de string para Date
        this.historicoMensal = {};
        Object.keys(dados.historicoMensal || {}).forEach(mes => {
          this.historicoMensal[mes] = dados.historicoMensal[mes].map((l: any) => ({
            ...l,
            data: new Date(l.data),
            pago: l.pago !== undefined ? l.pago : false
          }));
        });
        
        this.idCounter = dados.idCounter || 1;
        this.atualizarMesesDisponiveis();
      } else {
        // Migrar dados antigos se existirem
        this.migrarDadosAntigos();
      }
    } catch (error) {
      console.error('Erro ao carregar histórico do LocalStorage:', error);
    }
  }

  /**
   * Migra dados do formato antigo para o novo formato mensal
   */
  private migrarDadosAntigos(): void {
    try {
      const dadosAntigos = localStorage.getItem('controleFinanceiro');
      if (dadosAntigos) {
        const dados = JSON.parse(dadosAntigos);
        if (dados.lancamentos && dados.lancamentos.length > 0) {
          // Organizar por mês
          dados.lancamentos.forEach((l: any) => {
            const lancamento: Lancamento = {
              ...l,
              data: new Date(l.data),
              pago: l.pago !== undefined ? l.pago : false
            };
            const chaveMes = this.obterChaveMes(lancamento.data);
            if (!this.historicoMensal[chaveMes]) {
              this.historicoMensal[chaveMes] = [];
            }
          this.historicoMensal[chaveMes].push(lancamento);
        });
        
        this.idCounter = dados.idCounter || dados.lancamentos.length + 1;
        this.atualizarMesesDisponiveis();
        this.salvarHistoricoMensalLocalStorage();
        
        // Atualizar tabelas após migração
        this.carregarMesAtual();
          
          // Remover dados antigos
          localStorage.removeItem('controleFinanceiro');
        }
      }
    } catch (error) {
      console.error('Erro ao migrar dados antigos:', error);
    }
  }
}

