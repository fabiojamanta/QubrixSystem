import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';

type ClientOption = {
  id: number;
  registration_number?: string;
  name: string;
  document?: string;
  city?: string;
};

type ProductOption = {
  id: number;
  code: string;
  short_description: string;
  brand?: string;
  sale_unit?: string;
  suggested_price: number;
  general_price: number;
};

type QuoteItemRow = {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  description_choice: 'curta' | 'longa';
  extra_info: string;
};

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Cotações / Propostas" description="Gerenciar cotações, criar propostas e autorizar rentabilidade vermelha.">
  @if(auth.canWriteMenu('cotacoes')){ <button type="button" class="btn" (click)="openCreate()">Nova proposta</button> }
</app-page-header>
<div class="grid grid-4 card filters">
  <div><label>Status</label><select [(ngModel)]="filterStatus" (ngModelChange)="load()"><option value="">Todos</option><option value="aberta">Aberta</option><option value="ganha">Ganha</option><option value="perdida">Perdida</option></select></div>
  <div><label>Cliente</label><select [(ngModel)]="filterClientId" (ngModelChange)="load()"><option [ngValue]="null">Todos</option>@for(c of clients; track c.id){<option [ngValue]="c.id">{{ c.name }}</option>}</select></div>
  @if(auth.isManagement()){
    <div><label>Vendedor</label><select [(ngModel)]="filterSellerId" (ngModelChange)="load()"><option [ngValue]="null">Todos</option>@for(s of sellers; track s.id){<option [ngValue]="s.id">{{ s.name }}</option>}</select></div>
  }
  <div><label>Aprovação</label><select [(ngModel)]="filterApproval" (ngModelChange)="load()"><option value="">Todas</option><option value="pendente">Pendente</option><option value="autorizada">Autorizada</option><option value="nao_aplicavel">Não aplicável</option></select></div>
  <div><label>De</label><input type="date" [(ngModel)]="filterFrom" (ngModelChange)="load()"></div>
  <div><label>Até</label><input type="date" [(ngModel)]="filterTo" (ngModelChange)="load()"></div>
</div>
@if(error){<div class="error">{{error}}</div>}

<div class="card table-wrap"><table><thead><tr><th>#</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Prazo retorno</th><th>Aprovação</th><th></th></tr></thead>
<tbody>@for(q of rows; track q.id){
  <tr class="clickable" (click)="toggle(q.id)">
    <td>{{q.id}}</td><td>{{q.client_name}}</td><td>{{q.user_name}}</td><td>{{q.status}}</td>
    <td>{{q.response_deadline | dateBr}}</td>
    <td>@if(q.requires_management_approval){<span class="badge" [class.danger]="!q.management_approved" [class.ok]="q.management_approved">{{ q.management_approved ? 'Autorizada' : 'Pendente' }}</span>} @else { — }</td>
    <td><button type="button" class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); openDetail(q.id)">Detalhes</button></td>
  </tr>
  @if(expandedId===q.id && detail){
    <tr><td colspan="7">
      <div class="card inner-card">
        @if(detail.status==='perdida'){
          <div class="quote-lost-reason">
            <strong>Motivo da perda:</strong> {{ lostReasonText(detail) }}
          </div>
        }
        @for(item of detail.items; track item.id){
          <div class="quote-detail-item dash-item" [class.dash-item-danger]="item.profitability==='vermelho'" [class.dash-item-warn]="item.profitability==='amarelo'" [class.dash-item-ok]="item.profitability==='verde'">
            <div class="quote-item-head">
              <div class="dash-product-name">{{ item.code }} — {{ item.description }}</div>
              <span class="badge" [class.ok]="item.profitability==='verde'" [class.warn]="item.profitability==='amarelo'" [class.danger]="item.profitability==='vermelho'">{{ profitabilityLabel(item.profitability) }}</span>
            </div>
            <div class="dash-details">
              <div class="dash-detail-line">Quantidade: {{ item.quantity }} {{ item.sale_unit }}</div>
              <div class="dash-detail-line">Preço unitário: {{ item.unit_price | currency:'BRL' }}</div>
              <div class="dash-detail-line">Total: {{ item.total_price | currency:'BRL' }}</div>
              @if(item.extra_info){<div class="dash-detail-line">Info extra: {{ item.extra_info }}</div>}
            </div>
          </div>
        }
        <div class="form-actions">
          @if(detail.status==='aberta'){
            <button type="button" class="btn" (click)="setStatus(detail.id,'ganha')">Marcar ganha</button>
            <button type="button" class="btn btn-secondary" (click)="openLostModal(detail.id)">Marcar perdida</button>
          }
          @if(detail.requires_management_approval && !detail.management_approved && auth.canApproveQuotes()){
            <button type="button" class="btn" (click)="approve(detail.id)">Autorizar proposta</button>
          }
          <button type="button" class="btn btn-secondary" (click)="cloneQuote(detail.id)">Basear nova proposta</button>
        </div>
      </div>
    </td></tr>
  }
} @empty {<tr><td colspan="7" class="empty">Nenhuma cotação.</td></tr>}</tbody></table></div>

<app-form-modal [open]="createOpen" [title]="createModalTitle" (close)="closeCreate()">
  <div class="grid grid-3">
    <div class="quote-proposal-head grid-span-full">
      <div class="quote-proposal-number">
        <label>Nº proposta</label>
        <input [ngModel]="nextQuoteNumber" readonly>
      </div>
      <div class="quote-proposal-client">
        <label>Cliente</label>
        <div class="input-with-action">
          <input [ngModel]="clientDisplay()" readonly placeholder="Selecione um cliente">
          <button type="button" class="btn btn-secondary btn-sm" (click)="openClientSearch()">Pesquisar</button>
        </div>
      </div>
    </div>
    <div><label>Prazo retorno</label><input type="date" [(ngModel)]="createForm.response_deadline"></div>
    <div class="grid-span-full"><label>Informações relevantes</label><textarea [(ngModel)]="createForm.notes"></textarea></div>
    <div class="grid-span-full form-section-title">Itens da proposta</div>
  </div>

  <div class="quote-item-entry">
    <div class="quote-product-line">
      <div class="quote-product-field">
        <label>Produto</label>
        <div class="input-with-action">
          <input [ngModel]="pendingProductDisplay()" readonly placeholder="Selecione um produto">
          <button type="button" class="btn btn-secondary btn-sm" (click)="openProductSearch()">Pesquisar</button>
        </div>
      </div>
    </div>
    <div class="quote-item-fields">
      <div class="quote-field-sm"><label>Qtde</label><input type="number" step="0.01" min="0.01" [(ngModel)]="pendingItem.quantity"></div>
      <div class="quote-field-sm"><label>Preço unit.</label><input type="number" step="0.01" min="0" [(ngModel)]="pendingItem.unit_price"></div>
      <div class="quote-field-sm"><label>Descrição</label><select [(ngModel)]="pendingItem.description_choice"><option value="curta">Curta</option><option value="longa">Longa</option></select></div>
      <div class="quote-field-info"><label>Info extra</label><input [(ngModel)]="pendingItem.extra_info"></div>
      <div class="quote-field-action"><label>&nbsp;</label><button type="button" class="btn btn-sm" (click)="addPendingToGrid()">Incluir</button></div>
    </div>
  </div>

  <div class="card table-wrap quote-items-grid">
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Qtde</th>
          <th>Preço unit.</th>
          <th>Descrição</th>
          <th>Info extra</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for(item of createForm.items; track $index; let idx=$index){
          <tr>
            <td>{{ item.product_code }} — {{ item.product_name }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ item.unit_price | currency:'BRL' }}</td>
            <td>{{ item.description_choice === 'longa' ? 'Longa' : 'Curta' }}</td>
            <td>{{ item.extra_info || '—' }}</td>
            <td>{{ lineTotal(item) | currency:'BRL' }}</td>
            <td><button type="button" class="btn btn-secondary btn-sm" (click)="removeItem(idx)">Remover</button></td>
          </tr>
        } @empty {
          <tr><td colspan="7" class="empty">Nenhum item incluído.</td></tr>
        }
      </tbody>
    </table>
  </div>

  <div class="form-actions">
    <button type="button" class="btn" (click)="saveQuote()">Gerar proposta</button>
  </div>
</app-form-modal>

<app-form-modal [open]="lostModalOpen" title="Motivo da perda" (close)="closeLostModal()">
  <div class="lost-reason-options">
    @for(opt of lostReasonOptions; track opt.key){
      <label class="lost-reason-option">
        <input type="radio" name="lostReason" [(ngModel)]="lostForm.reason" [value]="opt.key">
        <span>{{ opt.label }}</span>
      </label>
    }
  </div>
  @if(lostForm.reason==='outro'){
    <div><label>Descreva o motivo</label><input [(ngModel)]="lostForm.detail" placeholder="Informe o motivo"></div>
  }
  @if(lostModalError){<div class="error">{{ lostModalError }}</div>}
  <div class="form-actions">
    <button type="button" class="btn" (click)="confirmLost()">Confirmar</button>
    <button type="button" class="btn btn-secondary" (click)="closeLostModal()">Cancelar</button>
  </div>
</app-form-modal>

@if(clientSearchOpen){
  <div class="modal-backdrop modal-backdrop-stacked" (click)="closeClientSearch()" role="presentation">
    <div class="modal-dialog client-search-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2 class="modal-title">Selecionar cliente</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="closeClientSearch()">×</button>
      </div>
      <div class="modal-body">
        <div class="client-search-bar">
          <input [(ngModel)]="clientSearchQuery" (ngModelChange)="searchClients()" placeholder="Nome, documento ou nº cadastro">
          <button type="button" class="btn btn-secondary btn-sm" (click)="searchClients()">Buscar</button>
        </div>
        @if(clientSearchLoading){<p class="empty">Buscando...</p>}
        @if(clientSearchError){<div class="error">{{ clientSearchError }}</div>}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nº</th><th>Nome</th><th>Documento</th><th>Cidade</th><th></th></tr></thead>
            <tbody>
              @for(c of clientSearchResults; track c.id){
                <tr>
                  <td>{{ c.registration_number || c.id }}</td>
                  <td>{{ c.name }}</td>
                  <td>{{ c.document || '—' }}</td>
                  <td>{{ c.city || '—' }}</td>
                  <td><button type="button" class="btn btn-sm" (click)="selectClient(c)">Selecionar</button></td>
                </tr>
              } @empty {
                @if(!clientSearchLoading){<tr><td colspan="5" class="empty">Nenhum cliente encontrado.</td></tr>}
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
}

@if(productSearchOpen){
  <div class="modal-backdrop modal-backdrop-stacked" (click)="closeProductSearch()" role="presentation">
    <div class="modal-dialog client-search-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2 class="modal-title">Selecionar produto</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="closeProductSearch()">×</button>
      </div>
      <div class="modal-body">
        <div class="client-search-bar">
          <input [(ngModel)]="productSearchQuery" (ngModelChange)="searchProducts()" placeholder="Código, descrição ou marca">
          <button type="button" class="btn btn-secondary btn-sm" (click)="searchProducts()">Buscar</button>
        </div>
        @if(productSearchLoading){<p class="empty">Buscando...</p>}
        @if(productSearchError){<div class="error">{{ productSearchError }}</div>}
        <div class="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Marca</th><th>Preço</th><th></th></tr></thead>
            <tbody>
              @for(p of productSearchResults; track p.id){
                <tr>
                  <td>{{ p.code }}</td>
                  <td>{{ p.short_description }}</td>
                  <td>{{ p.brand || '—' }}</td>
                  <td>{{ p.suggested_price | currency:'BRL' }}</td>
                  <td><button type="button" class="btn btn-sm" (click)="selectProduct(p)">Selecionar</button></td>
                </tr>
              } @empty {
                @if(!productSearchLoading){<tr><td colspan="5" class="empty">Nenhum produto encontrado.</td></tr>}
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
}`,
  styles: [`
.inner-card { margin: 8px 0; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.quote-detail-item { display: block; }
.quote-detail-item + .quote-detail-item { margin-top: 12px; }
.quote-proposal-head {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.quote-proposal-number input {
  text-align: center;
  padding-left: 8px;
  padding-right: 8px;
}
.quote-item-entry {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--glass-surface) 88%, transparent);
}
.quote-product-line { margin-bottom: 8px; }
.quote-product-field label { display: block; }
.quote-item-fields {
  display: grid;
  grid-template-columns: 88px 120px 110px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
}
.quote-field-sm input,
.quote-field-sm select {
  margin-bottom: 0;
}
.quote-field-info input { margin-bottom: 0; }
.quote-field-action .btn { margin: 6px 0 12px; white-space: nowrap; }
.quote-items-grid { margin-bottom: 16px; }
.quote-items-grid table { width: 100%; }
.quote-lost-reason {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
}
.lost-reason-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}
.lost-reason-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.lost-reason-option input {
  margin: 0;
  width: auto;
}
.input-with-action {
  display: flex;
  gap: 8px;
  align-items: center;
}
.input-with-action input {
  flex: 1;
  margin-bottom: 0;
}
.input-with-action .btn {
  flex-shrink: 0;
  margin: 6px 0 12px;
}
.client-search-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.client-search-bar input {
  flex: 1;
  margin-bottom: 0;
}
.client-search-bar .btn {
  flex-shrink: 0;
  margin: 6px 0 12px;
}
.client-search-dialog { max-width: 760px; width: 100%; }
@media (max-width: 640px) {
  .quote-proposal-head { grid-template-columns: 1fr; }
  .quote-item-fields {
    grid-template-columns: 1fr 1fr;
  }
  .quote-field-info,
  .quote-field-action {
    grid-column: 1 / -1;
  }
}
`],
})
export class QuotesComponent implements OnInit {
  rows: any[] = [];
  expandedId: number | null = null;
  detail: any = null;
  filterStatus = '';
  filterFrom = '';
  filterTo = '';
  filterClientId: number | null = null;
  filterSellerId: number | null = null;
  filterApproval = '';
  clients: ClientOption[] = [];
  sellers: { id: number; name: string }[] = [];
  error = '';
  createOpen = false;
  nextQuoteNumber: number | null = null;
  clientSearchOpen = false;
  clientSearchQuery = '';
  clientSearchResults: ClientOption[] = [];
  clientSearchLoading = false;
  clientSearchError = '';
  productSearchOpen = false;
  productSearchQuery = '';
  productSearchResults: ProductOption[] = [];
  productSearchLoading = false;
  productSearchError = '';
  lostModalOpen = false;
  lostQuoteId: number | null = null;
  lostForm = { reason: '', detail: '' };
  lostModalError = '';
  lostReasonOptions = [
    { key: 'preco', label: 'Preço' },
    { key: 'prazo_entrega', label: 'Prazo de entrega' },
    { key: 'prazo_pagamento', label: 'Prazo de pagamento' },
    { key: 'outra_marca', label: 'Preferência por outra marca' },
    { key: 'ma_fe', label: 'Má fé' },
    { key: 'outro', label: 'Outro' },
  ];
  pendingItem = this.emptyPendingItem();
  createForm: any = this.emptyCreateForm();
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() {
    this.load();
    this.api.get<ClientOption[]>('/clients').subscribe({ next: (r) => (this.clients = r), error: () => {} });
    if (this.auth.isManagement()) {
      this.api.get<{ id: number; name: string }[]>('/clients/sellers').subscribe({ next: (r) => (this.sellers = r), error: () => {} });
    }
  }
  get createModalTitle() {
    return this.nextQuoteNumber ? `Nova proposta #${this.nextQuoteNumber}` : 'Nova proposta';
  }
  emptyCreateForm() {
    return {
      client_id: null,
      client_name: '',
      response_deadline: '',
      notes: '',
      items: [] as QuoteItemRow[],
    };
  }
  emptyPendingItem() {
    return {
      product_id: null as number | null,
      product_code: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      description_choice: 'curta' as 'curta' | 'longa',
      extra_info: '',
    };
  }
  load() {
    this.api.get<any[]>('/quotes', {
      status: this.filterStatus || null,
      date_from: this.filterFrom || null,
      date_to: this.filterTo || null,
      client_id: this.filterClientId,
      user_id: this.filterSellerId,
      approval: this.filterApproval || null,
    }).subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) });
  }
  quoteSummaryFromDetail(d: any) {
    return {
      id: d.id,
      client_name: d.client_name,
      user_name: d.user_name,
      status: d.status,
      response_deadline: d.response_deadline,
      requires_management_approval: d.requires_management_approval,
      management_approved: d.management_approved,
      lost_reason: d.lost_reason,
      lost_reason_detail: d.lost_reason_detail,
    };
  }
  refreshQuoteView(id: number) {
    this.api.get<any>(`/quotes/${id}`).subscribe({
      next: (d) => {
        this.detail = d;
        this.expandedId = id;
        this.error = '';
        this.api.get<any[]>('/quotes', {
          status: this.filterStatus || null,
          date_from: this.filterFrom || null,
          date_to: this.filterTo || null,
          client_id: this.filterClientId,
          user_id: this.filterSellerId,
          approval: this.filterApproval || null,
        }).subscribe({
          next: (rows) => {
            this.rows = rows;
            const idx = this.rows.findIndex(q => q.id === id);
            if (idx >= 0) {
              this.rows[idx] = { ...this.rows[idx], ...this.quoteSummaryFromDetail(d) };
            } else {
              this.rows = [this.quoteSummaryFromDetail(d), ...this.rows];
            }
          },
          error: e => this.error = formatApiError(e.error?.detail),
        });
      },
      error: e => this.error = formatApiError(e.error?.detail),
    });
  }
  toggle(id:number){ this.expandedId = this.expandedId===id ? null : id; if(this.expandedId) this.openDetail(id); else this.detail=null; }
  openDetail(id:number){ this.api.get<any>(`/quotes/${id}`).subscribe({ next:(d)=>{ this.detail=d; this.expandedId=id; }, error:e=>this.error=formatApiError(e.error?.detail) }); }
  loadNextQuoteNumber() {
    this.api.get<{ next_number: number }>('/quotes/next-number').subscribe({
      next: (r) => (this.nextQuoteNumber = r.next_number),
      error: () => (this.nextQuoteNumber = null),
    });
  }
  openCreate() {
    this.createForm = this.emptyCreateForm();
    this.pendingItem = this.emptyPendingItem();
    this.nextQuoteNumber = null;
    this.createOpen = true;
    this.error = '';
    this.loadNextQuoteNumber();
  }
  closeCreate() {
    this.createOpen = false;
    this.closeClientSearch();
    this.closeProductSearch();
  }
  openClientSearch() {
    this.clientSearchOpen = true;
    this.clientSearchQuery = '';
    this.clientSearchResults = [];
    this.clientSearchError = '';
    this.searchClients();
  }
  closeClientSearch() {
    this.clientSearchOpen = false;
  }
  searchClients() {
    this.clientSearchLoading = true;
    this.clientSearchError = '';
    this.api.get<ClientOption[]>('/clients', { q: this.clientSearchQuery.trim() || null }).subscribe({
      next: (rows) => {
        this.clientSearchResults = rows;
        this.clientSearchLoading = false;
      },
      error: (e) => {
        this.clientSearchError = formatApiError(e.error?.detail);
        this.clientSearchLoading = false;
      },
    });
  }
  selectClient(client: ClientOption) {
    this.createForm.client_id = client.id;
    this.createForm.client_name = client.name;
    this.closeClientSearch();
  }
  clientDisplay() {
    if (!this.createForm.client_id) return '';
    return `${this.createForm.client_id} - ${this.createForm.client_name}`;
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
    this.api.get<ProductOption[]>('/quotes/products', {
      q: this.productSearchQuery.trim() || null,
      client_id: this.createForm.client_id,
    }).subscribe({
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
    this.pendingItem.product_id = product.id;
    this.pendingItem.product_code = product.code;
    this.pendingItem.product_name = product.short_description;
    this.pendingItem.unit_price = product.suggested_price ?? product.general_price ?? 0;
    this.closeProductSearch();
  }
  pendingProductDisplay() {
    if (!this.pendingItem.product_id) return '';
    return `${this.pendingItem.product_code} - ${this.pendingItem.product_name}`;
  }
  addPendingToGrid() {
    if (!this.pendingItem.product_id) {
      this.error = 'Selecione um produto antes de incluir.';
      return;
    }
    if (!this.pendingItem.quantity || this.pendingItem.quantity <= 0) {
      this.error = 'Informe uma quantidade válida.';
      return;
    }
    this.createForm.items.push({
      product_id: this.pendingItem.product_id,
      product_code: this.pendingItem.product_code,
      product_name: this.pendingItem.product_name,
      quantity: Number(this.pendingItem.quantity),
      unit_price: Number(this.pendingItem.unit_price) || 0,
      description_choice: this.pendingItem.description_choice,
      extra_info: this.pendingItem.extra_info || '',
    });
    this.pendingItem = this.emptyPendingItem();
    this.error = '';
  }
  lineTotal(item: QuoteItemRow) {
    return Number(item.quantity || 0) * Number(item.unit_price || 0);
  }
  removeItem(index: number) {
    this.createForm.items.splice(index, 1);
  }
  profitabilityLabel(value: string) {
    if (value === 'verde') return 'Rentável';
    if (value === 'amarelo') return 'Atenção';
    if (value === 'vermelho') return 'Prejuízo';
    return value || '—';
  }
  saveQuote(){
    if (!this.createForm.client_id) {
      this.error = 'Selecione um cliente antes de gerar a proposta.';
      return;
    }
    if (!this.createForm.items.length) {
      this.error = 'Inclua ao menos um item na proposta.';
      return;
    }
    const payload = {
      client_id: this.createForm.client_id,
      response_deadline: this.createForm.response_deadline || null,
      notes: this.createForm.notes,
      based_on_quote_id: this.createForm.based_on_quote_id || null,
      items: this.createForm.items.map((item: QuoteItemRow) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description_choice: item.description_choice,
        extra_info: item.extra_info,
      })),
    };
    this.api.post('/quotes', payload).subscribe({
      next:()=>{ this.closeCreate(); this.load(); },
      error:e=>this.error=formatApiError(e.error?.detail),
    });
  }
  setStatus(id:number, status:string){
    this.api.patch(`/quotes/${id}/status`, { status }).subscribe({
      next: () => this.refreshQuoteView(id),
      error: e => this.error = formatApiError(e.error?.detail),
    });
  }
  openLostModal(id: number) {
    this.lostQuoteId = id;
    this.lostForm = { reason: '', detail: '' };
    this.lostModalError = '';
    this.lostModalOpen = true;
  }
  closeLostModal() {
    this.lostModalOpen = false;
    this.lostQuoteId = null;
    this.lostModalError = '';
  }
  confirmLost() {
    if (!this.lostForm.reason) {
      this.lostModalError = 'Selecione um motivo.';
      return;
    }
    if (this.lostForm.reason === 'outro' && !this.lostForm.detail.trim()) {
      this.lostModalError = 'Informe o motivo.';
      return;
    }
    const id = this.lostQuoteId;
    if (!id) return;
    const payload: { status: string; lost_reason: string; lost_reason_detail?: string } = {
      status: 'perdida',
      lost_reason: this.lostForm.reason,
    };
    if (this.lostForm.reason === 'outro') {
      payload.lost_reason_detail = this.lostForm.detail.trim();
    }
    this.api.patch(`/quotes/${id}/status`, payload).subscribe({
      next: () => {
        this.closeLostModal();
        this.refreshQuoteView(id);
      },
      error: e => { this.lostModalError = formatApiError(e.error?.detail); },
    });
  }
  lostReasonLabel(key: string) {
    return this.lostReasonOptions.find(o => o.key === key)?.label || key;
  }
  lostReasonText(detail: any) {
    if (!detail?.lost_reason) return detail?.lost_reason_detail || '—';
    const label = this.lostReasonLabel(detail.lost_reason);
    if (detail.lost_reason === 'outro' && detail.lost_reason_detail) {
      return `${label}: ${detail.lost_reason_detail}`;
    }
    return label;
  }
  approve(id:number){ this.api.post(`/quotes/${id}/approve`, { approved:true }).subscribe({ next:()=>this.openDetail(id), error:e=>this.error=formatApiError(e.error?.detail) }); }
  cloneQuote(id:number){
    this.api.get<any>(`/quotes/${id}/clone-data`).subscribe({
      next:(d)=>{
        this.createForm={
          client_id: d.client_id,
          client_name: d.client_name || '',
          response_deadline: d.response_deadline || '',
          notes: d.notes || '',
          based_on_quote_id: id,
          items: (d.items || []).map((i:any)=>({
            product_id: i.product_id,
            product_code: i.code || '',
            product_name: i.description || '',
            quantity: i.quantity,
            unit_price: i.unit_price,
            description_choice: i.description_choice,
            extra_info: i.extra_info || '',
          })),
        };
        this.pendingItem = this.emptyPendingItem();
        this.createOpen = true;
        this.error = '';
        this.loadNextQuoteNumber();
      },
      error:e=>this.error=formatApiError(e.error?.detail),
    });
  }
}
