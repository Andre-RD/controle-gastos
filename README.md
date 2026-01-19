# Controle Financeiro

Aplicação Angular 13 para controle financeiro pessoal, permitindo registrar gastos e receitas organizados por categorias, com exportação para Excel.

## 🚀 Funcionalidades

- ✅ Cadastro de lançamentos financeiros (gastos e receitas)
- ✅ Categorização automática por tipo
- ✅ Listagem em tabela com Material Design
- ✅ Cálculo automático de totais (Receitas, Gastos, Saldo)
- ✅ Exportação para Excel (.xlsx)
- ✅ Persistência local com LocalStorage

## 📦 Tecnologias

- Angular 13
- Angular Material
- TypeScript
- SheetJS (xlsx)

## 🛠️ Instalação

1. Instale as dependências:
```bash
npm install
```

2. Execute a aplicação:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:4200
```

## 📝 Uso

1. **Adicionar Lançamento**: Preencha o formulário com data, descrição, valor, tipo e categoria
2. **Visualizar Totais**: Os cards exibem automaticamente os totais calculados
3. **Exportar Excel**: Clique no botão "Exportar para Excel" para baixar o arquivo

## 🗂️ Estrutura do Projeto

```
src/
 └─ app/
     ├─ app.component.ts       # Componente principal
     ├─ app.component.html     # Template
     ├─ app.component.scss     # Estilos
     ├─ app.module.ts          # Módulo principal
     ├─ material.module.ts     # Módulo Angular Material
     └─ models/
         ├─ lancamento.model.ts
         └─ categoria.model.ts
```

## 📊 Modelo de Dados

### Categoria
```typescript
interface Categoria {
  id: number;
  nome: string;
  tipo: 'GASTO' | 'RECEITA';
}
```

### Lançamento
```typescript
interface Lancamento {
  id: number;
  data: Date;
  descricao: string;
  valor: number;
  tipo: 'GASTO' | 'RECEITA';
  categoria: string;
}
```

## 🎨 Componentes Material Utilizados

- MatFormField
- MatInput
- MatSelect
- MatTable
- MatButton
- MatCard
- MatDatepicker
- MatIcon

## 📄 Licença

Este projeto é de uso pessoal.

