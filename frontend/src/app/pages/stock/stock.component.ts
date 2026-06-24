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
    <div><label>Produto ID</label><input type="number" [(ngModel)]="form.product_id"></div>
    <div><label>Lote</label><input [(ngModel)]="form.lot_number"></div>
    <div><label>Fabricante</label><input [(ngModel)]="form.manufacturer"></div>
    <div><label>Quantidade</label><input type="number" step="0.01" [(ngModel)]="form.quantity"></div>
    <div><label>Validade</label><input type="date" [(ngModel)]="form.expiry_date"></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button><button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Lote</th><th>Qtd</th><th>Validade</th><th>Fabricante</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.canWriteMenu('estoque')" (click)="auth.canWriteMenu('estoque') && edit(i)"><td>{{i.code}}</td><td>{{i.short_description}}</td><td>{{i.lot_number}}</td><td>{{i.quantity}}</td><td>{{i.expiry_date | dateBr}}</td><td>{{i.manufacturer||'-'}}</td></tr>} @empty {<tr><td colspan="6" class="empty">Nenhum registro.</td></tr>}</tbody></table></div>`,
})
export class StockComponent implements OnInit {
  rows: any[] = [];
  q = '';
  zeroStock = '';
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = { product_id: null, lot_number:'', manufacturer:'', quantity:0, expiry_date:'', active:true };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/stock', { q: this.q || null, zero_stock: this.zeroStock || null }).subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openNew() { this.form={ product_id:null, lot_number:'', manufacturer:'', quantity:0, expiry_date:'', active:true }; this.editingId=null; this.modalOpen=true; }
  edit(row:any) { this.form={...row}; this.editingId=row.id; this.modalOpen=true; }
  closeModal() { this.modalOpen=false; }
  save() {
    const req = this.editingId ? this.api.put(`/stock/${this.editingId}`, this.form) : this.api.post('/stock', this.form);
    req.subscribe({ next:()=>{ this.closeModal(); this.load(); }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
