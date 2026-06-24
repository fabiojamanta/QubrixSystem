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
            <button type="button" class="btn btn-secondary" (click)="setStatus(detail.id,'perdida')">Marcar perdida</button>
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
    <div><label>Nº proposta</label><input [ngModel]="nextQuoteNumber" readonly></div>
    <div><label>Cliente (ID)</label><input [ngModel]="createForm.client_id" readonly></div>
    <div class="grid-span-full">
      <label>Cliente</label>
      <div class="input-with-action">
        <input [ngModel]="createForm.client_name" readonly placeholder="Selecione um cliente">
        <button type="button" class="btn btn-secondary" (click)="openClientSearch()">Pesquisar</button>
      </div>
    </div>
    <div><label>Prazo retorno</label><input type="date" [(ngModel)]="createForm.response_deadline"></div>
    <div class="grid-span-full"><label>Informações relevantes</label><textarea [(ngModel)]="createForm.notes"></textarea></div>
    <div class="grid-span-full form-section-title">Itens da proposta</div>
  </div>

  @for(item of createForm.items; track $index; let idx=$index){
    <div class="quote-item-card">
      <div class="quote-item-head">
        <strong>Item {{ idx + 1 }}</strong>
        @if(createForm.items.length > 1){
          <button type="button" class="btn btn-secondary btn-sm" (click)="removeItem(idx)">Remover</button>
        }
      </div>
      <div class="grid grid-3">
        <div><label>Produto ID</label><input type="number" [(ngModel)]="item.product_id"></div>
        <div><label>Qtde</label><input type="number" step="0.01" [(ngModel)]="item.quantity"></div>
        <div><label>Preço unit.</label><input type="number" step="0.01" [(ngModel)]="item.unit_price"></div>
        <div><label>Descrição</label><select [(ngModel)]="item.description_choice"><option value="curta">Curta</option><option value="longa">Longa</option></select></div>
        <div class="grid-span-2"><label>Info extra</label><input [(ngModel)]="item.extra_info"></div>
      </div>
    </div>
  }

  <div class="form-actions">
    <button type="button" class="btn btn-secondary" (click)="addItem()">+ Item</button>
    <button type="button" class="btn" (click)="saveQuote()">Gerar proposta</button>
  </div>
</app-form-modal>

@if(clientSearchOpen){
  <div class="modal-backdrop" (click)="closeClientSearch()" role="presentation">
    <div class="modal-dialog client-search-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2 class="modal-title">Selecionar cliente</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="closeClientSearch()">×</button>
      </div>
      <div class="modal-body">
        <div class="client-search-bar">
          <input [(ngModel)]="clientSearchQuery" (ngModelChange)="searchClients()" placeholder="Nome, documento ou nº cadastro">
          <button type="button" class="btn btn-secondary" (click)="searchClients()">Buscar</button>
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
}`,
  styles: [`
.inner-card { margin: 8px 0; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.quote-item-card {
  margin: 0 0 16px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--glass-surface) 88%, transparent);
}
.quote-item-card:last-of-type { margin-bottom: 20px; }
.quote-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.quote-item-head strong {
  font-size: 0.95rem;
  color: var(--text);
}
.quote-detail-item { display: block; }
.quote-detail-item + .quote-detail-item { margin-top: 12px; }
.input-with-action {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.input-with-action input { flex: 1; }
.client-search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.client-search-bar input { flex: 1; }
.client-search-dialog { max-width: 760px; width: 100%; }
`],
})
export class QuotesComponent implements OnInit {
  rows: any[] = [];
  expandedId: number | null = null;
  detail: any = null;
  filterStatus = '';
  filterFrom = '';
  filterTo = '';
  error = '';
  createOpen = false;
  nextQuoteNumber: number | null = null;
  clientSearchOpen = false;
  clientSearchQuery = '';
  clientSearchResults: ClientOption[] = [];
  clientSearchLoading = false;
  clientSearchError = '';
  createForm: any = this.emptyCreateForm();
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  get createModalTitle() {
    return this.nextQuoteNumber ? `Nova proposta #${this.nextQuoteNumber}` : 'Nova proposta';
  }
  emptyCreateForm() {
    return {
      client_id: null,
      client_name: '',
      response_deadline: '',
      notes: '',
      items: [{ product_id: null, quantity: 1, unit_price: 0, description_choice: 'curta', extra_info: '' }],
    };
  }
  load() {
    this.api.get<any[]>('/quotes', { status: this.filterStatus || null, date_from: this.filterFrom || null, date_to: this.filterTo || null })
      .subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) });
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
    this.nextQuoteNumber = null;
    this.createOpen = true;
    this.error = '';
    this.loadNextQuoteNumber();
  }
  closeCreate() {
    this.createOpen = false;
    this.closeClientSearch();
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
  addItem(){ this.createForm.items.push({ product_id:null, quantity:1, unit_price:0, description_choice:'curta', extra_info:'' }); }
  removeItem(index: number) {
    if (this.createForm.items.length <= 1) return;
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
    const payload = {
      client_id: this.createForm.client_id,
      response_deadline: this.createForm.response_deadline || null,
      notes: this.createForm.notes,
      based_on_quote_id: this.createForm.based_on_quote_id || null,
      items: this.createForm.items,
    };
    this.api.post('/quotes', payload).subscribe({
      next:()=>{ this.closeCreate(); this.load(); },
      error:e=>this.error=formatApiError(e.error?.detail),
    });
  }
  setStatus(id:number, status:string){
    const lost_reason = status==='perdida' ? prompt('Motivo (preco, prazo_entrega, prazo_pagamento, outra_marca, ma_fe, outro):') : null;
    if(status==='perdida' && !lost_reason) return;
    this.api.patch(`/quotes/${id}/status`, { status, lost_reason }).subscribe({ next:()=>this.openDetail(id), error:e=>this.error=formatApiError(e.error?.detail) });
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
            quantity: i.quantity,
            unit_price: i.unit_price,
            description_choice: i.description_choice,
            extra_info: i.extra_info,
          })),
        };
        this.createOpen = true;
        this.error = '';
        this.loadNextQuoteNumber();
      },
      error:e=>this.error=formatApiError(e.error?.detail),
    });
  }
}
