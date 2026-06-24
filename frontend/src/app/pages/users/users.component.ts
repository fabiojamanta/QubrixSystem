import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Usuários" description="Cadastro de usuários e perfis de acesso.">
  @if(auth.canManageUsers()){ <button type="button" class="btn" (click)="openNew()">Novo usuário</button> }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar usuário' : 'Novo usuário'" (close)="closeModal()">
  <div class="grid grid-2">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>Email</label><input [(ngModel)]="form.email"></div>
    <div><label>Senha</label><input type="password" [(ngModel)]="form.password" [placeholder]="editingId ? 'Deixe vazio para manter' : ''"></div>
    <div><label>Perfil</label><select [(ngModel)]="form.profile_id"><option [ngValue]="null">Selecione</option>@for(p of profiles; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ativo</th></tr></thead>
<tbody>@for(u of rows; track u.id){<tr [class.clickable]="auth.canManageUsers()" (click)="auth.canManageUsers() && edit(u)"><td>{{u.name}}</td><td>{{u.email}}</td><td>{{u.profile?.name}}</td><td>{{u.active ? 'Sim' : 'Não'}}</td></tr>} @empty {<tr><td colspan="4" class="empty">Nenhum usuário.</td></tr>}</tbody></table></div>`,
})
export class UsersComponent implements OnInit {
  rows: any[] = [];
  profiles: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = { name:'', email:'', password:'', profile_id:null, active:true };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); this.api.get<any[]>('/users/profiles').subscribe({ next:(p)=>this.profiles=p }); }
  load() { this.api.get<any[]>('/users').subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openNew() { this.form={ name:'', email:'', password:'', profile_id:null, active:true }; this.editingId=null; this.modalOpen=true; }
  edit(row:any) { this.form={ name:row.name, email:row.email, password:'', profile_id:row.profile?.id, active:row.active }; this.editingId=row.id; this.modalOpen=true; }
  closeModal() { this.modalOpen=false; }
  save() {
    const body = { ...this.form };
    if(this.editingId && !body.password) delete body.password;
    const req = this.editingId ? this.api.put(`/users/${this.editingId}`, body) : this.api.post('/users', body);
    req.subscribe({ next:()=>{ this.closeModal(); this.load(); }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
