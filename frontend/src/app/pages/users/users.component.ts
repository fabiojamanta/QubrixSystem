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
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Usuários" description="Cadastro de usuários e perfis de acesso.">
  @if(auth.canManageUsers()){ <button type="button" class="btn" (click)="openNew()">Novo usuário</button> }
</app-page-header>
<div class="grid grid-4 card filters">
  <div><label>Nome ou email</label><input [(ngModel)]="filterQ" (ngModelChange)="load()" placeholder="Buscar"></div>
  <div><label>Perfil</label><select [(ngModel)]="filterProfileId" (ngModelChange)="load()"><option [ngValue]="null">Todos</option>@for(p of profiles; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
  <div><label>Ativo</label><select [(ngModel)]="filterActive" (ngModelChange)="load()"><option [ngValue]="null">Todos</option><option [ngValue]="true">Sim</option><option [ngValue]="false">Não</option></select></div>
</div>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar usuário' : 'Novo usuário'" (close)="closeModal()">
  <div class="grid grid-2">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>Email</label><input [(ngModel)]="form.email"></div>
    <div><label>Senha</label><input type="password" [(ngModel)]="form.password" [placeholder]="editingId ? 'Deixe vazio para manter' : ''"></div>
    <div><label>Perfil</label><select [(ngModel)]="form.profile_id"><option [ngValue]="null">Selecione</option>@for(p of profiles; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
    <label class="form-toggle grid-span-full">
      <input type="checkbox" [(ngModel)]="form.active">
      <span class="form-toggle-copy">
        <span class="form-toggle-title">Usuário ativo</span>
        <span class="form-toggle-desc">Usuários inativos não conseguem acessar o sistema.</span>
      </span>
    </label>
    @if(editingId){
      <div><label>Criado em</label><input [ngModel]="form.created_at | dateBr:'datetime'" readonly></div>
      <div><label>Atualizado em</label><input [ngModel]="form.updated_at | dateBr:'datetime'" readonly></div>
    }
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ativo</th><th>Criado em</th></tr></thead>
<tbody>@for(u of rows; track u.id){<tr [class.clickable]="auth.canManageUsers()" (click)="auth.canManageUsers() && edit(u)"><td>{{u.name}}</td><td>{{u.email}}</td><td>{{u.profile?.name}}</td><td>{{u.active ? 'Sim' : 'Não'}}</td><td>{{u.created_at | dateBr:'datetime'}}</td></tr>} @empty {<tr><td colspan="5" class="empty">Nenhum usuário.</td></tr>}</tbody></table></div>`,
})
export class UsersComponent implements OnInit {
  rows: any[] = [];
  profiles: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  filterQ = '';
  filterProfileId: number | null = null;
  filterActive: boolean | null = null;
  form: any = { name: '', email: '', password: '', profile_id: null, active: true, created_at: '', updated_at: '' };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() {
    this.load();
    this.api.get<any[]>('/users/profiles').subscribe({ next: (p) => (this.profiles = p) });
  }
  load() {
    this.api.get<any[]>('/users', {
      q: this.filterQ.trim() || null,
      profile_id: this.filterProfileId,
      active: this.filterActive === null ? null : this.filterActive ? 'true' : 'false',
    }).subscribe({ next: (r) => (this.rows = r), error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
  openNew() { this.form = { name: '', email: '', password: '', profile_id: null, active: true, created_at: '', updated_at: '' }; this.editingId = null; this.modalOpen = true; }
  edit(row: any) {
    this.form = {
      name: row.name,
      email: row.email,
      password: '',
      profile_id: row.profile?.id,
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    this.editingId = row.id;
    this.modalOpen = true;
  }
  closeModal() { this.modalOpen = false; }
  save() {
    const body = { ...this.form };
    delete body.created_at;
    delete body.updated_at;
    if (this.editingId && !body.password) delete body.password;
    const req = this.editingId ? this.api.put(`/users/${this.editingId}`, body) : this.api.post('/users', body);
    req.subscribe({ next: () => { this.closeModal(); this.load(); }, error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
}
