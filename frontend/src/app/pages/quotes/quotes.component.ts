import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';

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
          <div class="dash-item" [class.dash-item-danger]="item.profitability==='vermelho'" [class.dash-item-warn]="item.profitability==='amarelo'" [class.dash-item-ok]="item.profitability==='verde'">
            <div class="dash-product-name">{{ item.code }} — {{ item.description }}</div>
            <div class="dash-detail-line">Qtd: {{ item.quantity }} {{ item.sale_unit }} · Unit: {{ item.unit_price | currency:'BRL' }} · Total: {{ item.total_price | currency:'BRL' }}</div>
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

<app-form-modal [open]="createOpen" title="Nova proposta" (close)="createOpen=false">
  <div class="grid grid-3">
    <div><label>Cliente ID</label><input type="number" [(ngModel)]="createForm.client_id"></div>
    <div><label>Prazo retorno</label><input type="date" [(ngModel)]="createForm.response_deadline"></div>
    <div class="grid-span-3"><label>Informações relevantes</label><textarea [(ngModel)]="createForm.notes"></textarea></div>
    <div class="grid-span-3"><h4>Itens</h4></div>
    @for(item of createForm.items; track $index; let idx=$index){
      <div><label>Produto ID</label><input type="number" [(ngModel)]="item.product_id"></div>
      <div><label>Qtde</label><input type="number" step="0.01" [(ngModel)]="item.quantity"></div>
      <div><label>Preço unit.</label><input type="number" step="0.01" [(ngModel)]="item.unit_price"></div>
      <div><label>Descrição</label><select [(ngModel)]="item.description_choice"><option value="curta">Curta</option><option value="longa">Longa</option></select></div>
      <div class="grid-span-2"><label>Info extra</label><input [(ngModel)]="item.extra_info"></div>
    }
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" (click)="addItem()">+ Item</button>
      <button type="button" class="btn" (click)="saveQuote()">Gerar proposta</button>
    </div>
  </div>
</app-form-modal>`,
  styles: [`.inner-card{margin:8px 0}.btn-sm{padding:6px 12px;font-size:13px}`],
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
  createForm: any = { client_id: null, response_deadline: '', notes: '', items: [{ product_id: null, quantity: 1, unit_price: 0, description_choice: 'curta', extra_info: '' }] };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() {
    this.api.get<any[]>('/quotes', { status: this.filterStatus || null, date_from: this.filterFrom || null, date_to: this.filterTo || null })
      .subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) });
  }
  toggle(id:number){ this.expandedId = this.expandedId===id ? null : id; if(this.expandedId) this.openDetail(id); else this.detail=null; }
  openDetail(id:number){ this.api.get<any>(`/quotes/${id}`).subscribe({ next:(d)=>{ this.detail=d; this.expandedId=id; }, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openCreate(){ this.createOpen=true; this.error=''; }
  addItem(){ this.createForm.items.push({ product_id:null, quantity:1, unit_price:0, description_choice:'curta', extra_info:'' }); }
  saveQuote(){
    this.api.post('/quotes', this.createForm).subscribe({
      next:()=>{ this.createOpen=false; this.load(); },
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
        this.createForm={ client_id:d.client_id, response_deadline:d.response_deadline||'', notes:d.notes||'', based_on_quote_id:id, items:(d.items||[]).map((i:any)=>({ product_id:i.product_id, quantity:i.quantity, unit_price:i.unit_price, description_choice:i.description_choice, extra_info:i.extra_info })) };
        this.createOpen=true;
      },
      error:e=>this.error=formatApiError(e.error?.detail),
    });
  }
}
