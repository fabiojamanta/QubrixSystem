import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';

type ProductOption = {
  id: number;
  code: string;
  short_description: string;
  brand?: string;
};

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Estoque" description="Consulta por código, nome, fabricante e saldo.">
  @if(auth.canWriteMenu('estoque')){ <button type="button" class="btn" (click)="openNew()">Incluir lote</button> }
</app-page-header>
<div class="grid grid-3 card filters">
  <div><label>Busca</label><input [(ngModel)]="q" (ngModelChange)="load()" placeholder="Código, nome ou fabricante"></div>
  <div><label>Estoque</label><select [(ngModel)]="zeroStock" (ngModelChange)="load()"><option value="">Todos</option><option value="no">Diferente de zero</option><option value="yes">Zerado</option></select></div>
</div>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar lote' : 'Novo lote'" (close)="closeModal()">
  <div class="grid grid-3">
    <div class="grid-span-full">
      <label>Produto</label>
      <div class="input-with-action">
        <input [ngModel]="productDisplay()" readonly placeholder="Selecione um produto">
        <button type="button" class="btn btn-secondary btn-sm" (click)="openProductSearch()">Pesquisar</button>
      </div>
    </div>
    <div><label>Lote</label><input [(ngModel)]="form.lot_number"></div>
    <div><label>Quantidade</label><input type="number" step="0.01" [(ngModel)]="form.quantity"></div>
    <div><label>Validade</label><input type="date" [(ngModel)]="form.expiry_date"></div>
    <div class="form-actions grid-span-full"><button type="button" class="btn" (click)="save()">Salvar</button><button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button></div>
  </div>
</app-form-modal>

@if(productSearchOpen){
  <div class="modal-backdrop modal-backdrop-stacked" (click)="closeProductSearch()" role="presentation">
    <div class="modal-dialog stock-search-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2 class="modal-title">Selecionar produto</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="closeProductSearch()">×</button>
      </div>
      <div class="modal-body">
        <div class="search-bar">
          <input [(ngModel)]="productSearchQuery" (ngModelChange)="searchProducts()" placeholder="Código, descrição ou fabricante">
          <button type="button" class="btn btn-secondary btn-sm" (click)="searchProducts()">Buscar</button>
        </div>
        @if(productSearchLoading){<p class="empty">Buscando...</p>}
        @if(productSearchError){<div class="error">{{ productSearchError }}</div>}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Fabricante</th><th></th></tr></thead>
            <tbody>
              @for(p of productSearchResults; track p.id){
                <tr>
                  <td>{{ p.code }}</td>
                  <td>{{ p.short_description }}</td>
                  <td>{{ p.brand || '—' }}</td>
                  <td><button type="button" class="btn btn-sm" (click)="selectProduct(p)">Selecionar</button></td>
                </tr>
              } @empty {
                @if(!productSearchLoading){<tr><td colspan="4" class="empty">Nenhum produto encontrado.</td></tr>}
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
}

<div class="card table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Lote</th><th>Qtd</th><th>Validade</th><th>Fabricante</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.canWriteMenu('estoque')" (click)="auth.canWriteMenu('estoque') && edit(i)"><td>{{i.code}}</td><td>{{i.short_description}}</td><td>{{i.lot_number}}</td><td>{{i.quantity}}</td><td>{{i.expiry_date | dateBr}}</td><td>{{i.manufacturer||'-'}}</td></tr>} @empty {<tr><td colspan="6" class="empty">Nenhum registro.</td></tr>}</tbody></table></div>`,
  styles: [`
    .input-with-action,
    .search-bar {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .input-with-action input,
    .search-bar input {
      flex: 1;
      margin-bottom: 0;
    }
    .input-with-action .btn,
    .search-bar .btn {
      flex-shrink: 0;
      margin: 6px 0 12px;
    }
    .stock-search-dialog { max-width: 760px; width: 100%; }
  `],
})
export class StockComponent implements OnInit {
  rows: any[] = [];
  q = '';
  zeroStock = '';
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  productSearchOpen = false;
  productSearchQuery = '';
  productSearchResults: ProductOption[] = [];
  productSearchLoading = false;
  productSearchError = '';
  form: any = this.emptyForm();
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  emptyForm() {
    return {
      product_id: null,
      product_code: '',
      product_name: '',
      product_brand: '',
      lot_number: '',
      quantity: 0,
      expiry_date: '',
      active: true,
    };
  }
  load() {
    this.api.get<any[]>('/stock', { q: this.q || null, zero_stock: this.zeroStock || null })
      .subscribe({ next: (r) => (this.rows = r), error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
  openNew() {
    this.form = this.emptyForm();
    this.editingId = null;
    this.modalOpen = true;
    this.error = '';
  }
  edit(row: any) {
    this.form = {
      product_id: row.product_id,
      product_code: row.code,
      product_name: row.short_description,
      product_brand: row.manufacturer || row.brand || '',
      lot_number: row.lot_number,
      quantity: row.quantity,
      expiry_date: row.expiry_date || '',
      active: row.active,
    };
    this.editingId = row.id;
    this.modalOpen = true;
    this.error = '';
  }
  closeModal() {
    this.modalOpen = false;
    this.closeProductSearch();
  }
  productDisplay() {
    if (!this.form.product_id) return '';
    return `${this.form.product_code} - ${this.form.product_name}`;
  }
  openProductSearch() {
    this.productSearchOpen = true;
    this.productSearchQuery = '';
    this.productSearchResults = [];
    this.productSearchError = '';
    this.searchProducts();
  }
  closeProductSearch() {
    this.productSearchOpen = false;
  }
  searchProducts() {
    this.productSearchLoading = true;
    this.productSearchError = '';
    this.api.get<ProductOption[]>('/stock/products', { q: this.productSearchQuery.trim() || null }).subscribe({
      next: (rows) => {
        this.productSearchResults = rows;
        this.productSearchLoading = false;
      },
      error: (e) => {
        this.productSearchError = formatApiError(e.error?.detail);
        this.productSearchLoading = false;
      },
    });
  }
  selectProduct(product: ProductOption) {
    this.form.product_id = product.id;
    this.form.product_code = product.code;
    this.form.product_name = product.short_description;
    this.form.product_brand = product.brand || '';
    this.closeProductSearch();
  }
  save() {
    if (!this.form.product_id) {
      this.error = 'Selecione um produto antes de salvar.';
      return;
    }
    const payload = {
      product_id: this.form.product_id,
      lot_number: this.form.lot_number,
      quantity: this.form.quantity,
      expiry_date: this.form.expiry_date || null,
      active: this.form.active,
    };
    const req = this.editingId ? this.api.put(`/stock/${this.editingId}`, payload) : this.api.post('/stock', payload);
    req.subscribe({
      next: () => { this.closeModal(); this.load(); },
      error: (e) => (this.error = formatApiError(e.error?.detail)),
    });
  }
}
