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
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Clientes" description="Cadastro de clientes e tabela de preços por cliente (via produtos)." [logoSrc]="logo" logoAlt="Clientes">
  @if(auth.canCreateClient()){ <button type="button" class="btn" (click)="openNew()">Incluir</button> }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar cliente' : 'Novo cliente'" (close)="closeModal()">
  <div class="grid grid-3">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>Documento</label><input [(ngModel)]="form.document"></div>
    <div><label>Telefone</label><input [(ngModel)]="form.phone"></div>
    <div><label>Email</label><input [(ngModel)]="form.email"></div>
    <div><label>Cidade</label><input [(ngModel)]="form.city"></div>
    <div><label>UF</label><input [(ngModel)]="form.state" maxlength="2"></div>
    <div class="grid-span-3"><label>Endereço</label><input [(ngModel)]="form.address"></div>
    <div class="grid-span-3"><label>Observações</label><textarea [(ngModel)]="form.notes"></textarea></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button><button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>Email</th><th>Cidade</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.canUpdateClient()" (click)="auth.canUpdateClient() && edit(i)"><td>{{i.name}}</td><td>{{i.document||'-'}}</td><td>{{i.phone||'-'}}</td><td>{{i.email||'-'}}</td><td>{{i.city||'-'}}</td></tr>} @empty {<tr><td colspan="5" class="empty">Nenhum cliente.</td></tr>}</tbody></table></div>`,
})
export class ClientsComponent implements OnInit {
  logo = PAGE_LOGOS.cliente;
  rows: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = { name:'', document:'', phone:'', email:'', address:'', city:'', state:'', notes:'', active:true };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/clients').subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openNew() { this.form={ name:'', document:'', phone:'', email:'', address:'', city:'', state:'', notes:'', active:true }; this.editingId=null; this.modalOpen=true; }
  edit(row:any) { this.form={...row}; this.editingId=row.id; this.modalOpen=true; }
  closeModal() { this.modalOpen=false; }
  save() {
    const req = this.editingId ? this.api.put(`/clients/${this.editingId}`, this.form) : this.api.post('/clients', this.form);
    req.subscribe({ next:()=>{ this.closeModal(); this.load(); }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
