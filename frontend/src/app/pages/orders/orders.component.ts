import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent],
  template: `
<app-page-header title="Pedidos" description="Entrada de pedidos recebidos no escritório para processamento." />
@if(error){<div class="error">{{error}}</div>}

<div class="card table-wrap"><table><thead><tr><th>#</th><th>Cliente</th><th>Responsável</th><th>Status</th><th>Data</th><th></th></tr></thead>
<tbody>@for(o of rows; track o.id){
  <tr>
    <td>{{o.id}}</td><td>{{o.client_name}}</td><td>{{o.user_name}}</td><td>{{o.status}}</td><td>{{o.created_at | dateBr:'datetime'}}</td>
    <td><button type="button" class="btn btn-secondary btn-sm" (click)="toggle(o.id)">{{ expandedId===o.id ? 'Fechar' : 'Expandir' }}</button></td>
  </tr>
  @if(expandedId===o.id && detail){
    <tr><td colspan="6"><div class="card inner-card">
      @for(item of detail.items; track item.id){
        <div class="dash-item"><div class="dash-product-name">{{ item.code }} — {{ item.product_name }}</div>
        <div class="dash-detail-line">Qtd: {{ item.quantity }} · Unit: {{ item.unit_price | currency:'BRL' }} · Total: {{ item.total_price | currency:'BRL' }}</div></div>
      }
      <div class="dash-detail-line"><b>Total pedido:</b> {{ detail.total_amount | currency:'BRL' }}</div>
    </div></td></tr>
  }
} @empty {<tr><td colspan="6" class="empty">Nenhum pedido.</td></tr>}</tbody></table></div>`,
  styles: [`.inner-card{margin:8px 0}.btn-sm{padding:6px 12px;font-size:13px}`],
})
export class OrdersComponent implements OnInit {
  rows: any[] = [];
  expandedId: number | null = null;
  detail: any = null;
  error = '';
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/orders').subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  toggle(id:number){
    if(this.expandedId===id){ this.expandedId=null; this.detail=null; return; }
    this.api.get<any>(`/orders/${id}`).subscribe({ next:(d)=>{ this.detail=d; this.expandedId=id; }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
