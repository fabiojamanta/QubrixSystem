import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent],
  template: `
<app-page-header title="Vendas / Faturamento" description="Gerencial vê tudo; vendedor vê somente as próprias vendas." />
<div class="grid grid-4 card filters">
  @if(auth.isManagement()){
    <div>
      <label>Vendedor</label>
      <select [(ngModel)]="filterSellerId" (ngModelChange)="load()">
        <option [ngValue]="null">Todos</option>
        @for(s of sellers; track s.id){ <option [ngValue]="s.id">{{ s.name }}</option> }
      </select>
    </div>
  }
  <div><label>Data inicial</label><input type="date" [(ngModel)]="filterFrom" (ngModelChange)="load()"></div>
  <div><label>Data final</label><input type="date" [(ngModel)]="filterTo" (ngModelChange)="load()"></div>
</div>
@if(summary){
  <div class="grid grid-2">
    <div class="card stat"><b>{{ summary.month_total | currency:'BRL' }}</b><span>Total mês</span></div>
    <div class="card stat"><b>{{ summary.last_year_same_period | currency:'BRL' }}</b><span>Mesmo período ano anterior</span></div>
  </div>
}
@if(error){<div class="error">{{error}}</div>}

<div class="card table-wrap"><table><thead><tr><th>#</th><th>Cliente</th><th>Vendedor</th><th>NF</th><th>Data</th><th>Total</th><th></th></tr></thead>
<tbody>@for(s of rows; track s.id){
  <tr>
    <td>{{s.id}}</td><td>{{s.client_name}}</td><td>{{s.user_name}}</td><td>{{s.invoice_number||'-'}}</td><td>{{s.sale_date | dateBr}}</td><td>{{s.total_amount | currency:'BRL'}}</td>
    <td><button type="button" class="btn btn-secondary btn-sm" (click)="toggle(s.id)">{{ expandedId===s.id ? 'Fechar' : 'Itens' }}</button></td>
  </tr>
  @if(expandedId===s.id && detail){
    <tr><td colspan="7"><div class="card inner-card">
      @for(item of detail.items; track item.id){
        <div class="dash-item"><div class="dash-product-name">{{ item.code }} — {{ item.product_name }}</div>
        <div class="dash-detail-line">Qtd: {{ item.quantity }} · Unit: {{ item.unit_price | currency:'BRL' }} · Total: {{ item.total_price | currency:'BRL' }}</div></div>
      }
    </div></td></tr>
  }
} @empty {<tr><td colspan="7" class="empty">Nenhuma venda.</td></tr>}</tbody></table></div>`,
  styles: [`.inner-card{margin:8px 0}.btn-sm{padding:6px 12px;font-size:13px}`],
})
export class SalesComponent implements OnInit {
  rows: any[] = [];
  summary: any = null;
  sellers: { id: number; name: string }[] = [];
  filterSellerId: number | null = null;
  filterFrom = '';
  filterTo = '';
  expandedId: number | null = null;
  detail: any = null;
  error = '';
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() {
    if (this.auth.isManagement()) {
      this.api.get<{ id: number; name: string }[]>('/clients/sellers').subscribe({
        next: (r) => (this.sellers = r),
        error: () => {},
      });
    }
    this.load();
  }
  load() {
    this.api.get<any[]>('/sales', {
      user_id: this.filterSellerId,
      date_from: this.filterFrom || null,
      date_to: this.filterTo || null,
    }).subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) });
    this.api.get<any>('/sales/summary', { months: 12 }).subscribe({ next:(s)=>this.summary=s });
  }
  toggle(id:number){
    if(this.expandedId===id){ this.expandedId=null; this.detail=null; return; }
    this.api.get<any>(`/sales/${id}`).subscribe({ next:(d)=>{ this.detail=d; this.expandedId=id; }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
