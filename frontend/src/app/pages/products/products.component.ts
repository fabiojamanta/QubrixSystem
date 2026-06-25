import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';
import { PAGE_LOGOS } from '../../shared/page-logos';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Produtos" description="Cadastro com tabela geral e desconto máximo por item." [logoSrc]="logo" logoAlt="Produtos">
  @if(auth.canCreateProduct()){ <button type="button" class="btn" (click)="openNew()">Incluir</button> }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}
@if(!auth.canManageProducts()){<div class="readonly-banner">Inclusão e alteração permitidas somente para Gerência/Supervisão.</div>}

<div class="grid grid-2 card filters">
  <div><label>Buscar</label><input [(ngModel)]="filterQ" (ngModelChange)="load()" placeholder="Código, descrição ou fabricante"></div>
</div>

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar produto' : 'Novo produto'" (close)="closeModal()">
  <div class="grid grid-3">
    <div><label>Código</label><input [(ngModel)]="form.code"></div>
    <div><label>Descrição curta</label><input [(ngModel)]="form.short_description"></div>
    <div><label>Fabricante</label><input [(ngModel)]="form.brand"></div>
    <div class="grid-span-2"><label>Descrição longa</label><textarea [(ngModel)]="form.long_description"></textarea></div>
    <div><label>Qtd por embalagem</label><input type="number" [(ngModel)]="form.qty_per_package"></div>
    <div><label>Unidade de venda</label>
      <select [(ngModel)]="form.sale_unit"><option value="CX">CX</option><option value="PCT">PCT</option><option value="KIT">KIT</option><option value="UNIT">UNIT</option></select>
    </div>
    <div><label>Preço tabela geral</label><input type="number" step="0.01" [(ngModel)]="form.general_price"></div>
    <div><label>Desconto máx. (%)</label><input type="number" step="0.01" [(ngModel)]="form.max_discount_pct"></div>
    <div><label>Custo</label><input type="number" step="0.01" [(ngModel)]="form.cost_price"></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button><button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Fabricante</th><th>Unidade</th><th>Preço geral</th><th>Desc. máx.</th><th>Estoque</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.canUpdateProduct()" (click)="auth.canUpdateProduct() && edit(i)"><td>{{i.code}}</td><td>{{i.short_description}}</td><td>{{i.brand||'-'}}</td><td>{{i.qty_per_package}} {{i.sale_unit}}</td><td>{{i.general_price|currency:'BRL'}}</td><td>{{i.max_discount_pct}}%</td><td>{{i.stock_qty}}</td></tr>} @empty {<tr><td colspan="7" class="empty">Nenhum produto.</td></tr>}</tbody></table></div>`,
})
export class ProductsComponent implements OnInit {
  logo = PAGE_LOGOS.produto;
  rows: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = this.emptyForm();
  filterQ = '';
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  emptyForm() { return { code:'', short_description:'', long_description:'', brand:'', qty_per_package:1, sale_unit:'UNIT', general_price:0, max_discount_pct:0, cost_price:0, active:true }; }
  load() { this.api.get<any[]>('/products', { q: this.filterQ.trim() || null }).subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openNew() { this.form=this.emptyForm(); this.editingId=null; this.modalOpen=true; this.error=''; }
  edit(row:any) { this.form={...row}; this.editingId=row.id; this.modalOpen=true; this.error=''; }
  closeModal() { this.modalOpen=false; this.error=''; }
  save() {
    const req = this.editingId ? this.api.put(`/products/${this.editingId}`, this.form) : this.api.post('/products', this.form);
    req.subscribe({ next:()=>{ this.closeModal(); this.load(); }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
