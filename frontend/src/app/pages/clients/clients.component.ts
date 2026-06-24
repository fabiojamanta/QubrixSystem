import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';
import { PAGE_LOGOS } from '../../shared/page-logos';

type ClientContactForm = { name: string; phone: string; email: string };

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
    @if(editingId){
      <div><label>Nº cadastro</label><input [ngModel]="form.registration_number" readonly></div>
    }
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>Documento</label><input [(ngModel)]="form.document"></div>
    <div><label>Telefone principal</label><input [(ngModel)]="form.phone"></div>
    <div><label>Email principal</label><input [(ngModel)]="form.email"></div>
    <div><label>Cidade</label><input [(ngModel)]="form.city"></div>
    <div><label>UF</label><input [(ngModel)]="form.state" maxlength="2"></div>
    @if(auth.canCreateClient() || auth.canUpdateClient()){
      <div class="grid-span-full">
        <label>Vendedor responsável</label>
        <select [(ngModel)]="form.responsible_user_id">
          <option [ngValue]="null">— Selecione —</option>
          @for(s of sellers; track s.id){ <option [ngValue]="s.id">{{ s.name }}</option> }
        </select>
      </div>
    }
    <div class="grid-span-full"><label>Endereço</label><input [(ngModel)]="form.address"></div>
    <div class="grid-span-full"><label>Observações</label><textarea [(ngModel)]="form.notes"></textarea></div>
  </div>

  <h4 class="client-contacts-title">Contatos (até 3)</h4>
  <div class="client-contacts-grid">
    @for(contact of form.contacts; track $index; let i = $index){
      <div class="card client-contact-card">
        <div class="client-contact-label">Contato {{ i + 1 }}</div>
        <div class="grid grid-3">
          <div><label>Nome</label><input [(ngModel)]="contact.name"></div>
          <div><label>Celular</label><input [(ngModel)]="contact.phone"></div>
          <div><label>Email</label><input [(ngModel)]="contact.email"></div>
        </div>
      </div>
    }
  </div>

  <div class="form-actions">
    <button type="button" class="btn" (click)="save()">Salvar</button>
    <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Nº</th><th>Nome</th><th>Vendedor</th><th>Documento</th><th>Telefone</th><th>Cidade</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.canUpdateClient()" (click)="auth.canUpdateClient() && edit(i)"><td>{{i.registration_number||i.id}}</td><td>{{i.name}}</td><td>{{i.responsible_user_name||'-'}}</td><td>{{i.document||'-'}}</td><td>{{i.phone||'-'}}</td><td>{{i.city||'-'}}</td></tr>} @empty {<tr><td colspan="6" class="empty">Nenhum cliente.</td></tr>}</tbody></table></div>`,
  styles: [`
    .client-contacts-title { margin: 16px 0 8px; font-size: 1rem; font-weight: 700; }
    .client-contacts-grid { display: grid; gap: 10px; margin-bottom: 12px; }
    .client-contact-card { padding: 12px; }
    .client-contact-label { font-size: 13px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }
  `],
})
export class ClientsComponent implements OnInit {
  logo = PAGE_LOGOS.cliente;
  rows: any[] = [];
  sellers: { id: number; name: string }[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form = this.emptyForm();
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() {
    this.load();
    this.api.get<{ id: number; name: string }[]>('/clients/sellers').subscribe({
      next: (r) => (this.sellers = r),
      error: () => {},
    });
  }
  emptyForm() {
    return {
      name: '',
      document: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      notes: '',
      responsible_user_id: null as number | null,
      registration_number: '',
      contacts: this.emptyContacts(),
      active: true,
    };
  }
  emptyContacts(): ClientContactForm[] {
    return [
      { name: '', phone: '', email: '' },
      { name: '', phone: '', email: '' },
      { name: '', phone: '', email: '' },
    ];
  }
  load() {
    this.api.get<any[]>('/clients').subscribe({
      next: (r) => (this.rows = r),
      error: (e) => (this.error = formatApiError(e.error?.detail)),
    });
  }
  openNew() {
    this.form = this.emptyForm();
    this.editingId = null;
    this.modalOpen = true;
  }
  edit(row: any) {
    const contacts = this.emptyContacts();
    (row.contacts || []).slice(0, 3).forEach((c: any, i: number) => {
      contacts[i] = { name: c.name || '', phone: c.phone || '', email: c.email || '' };
    });
    this.form = { ...row, contacts };
    this.editingId = row.id;
    this.modalOpen = true;
  }
  closeModal() {
    this.modalOpen = false;
  }
  save() {
    const payload = {
      ...this.form,
      responsible_user_id: this.form.responsible_user_id || null,
      contacts: this.form.contacts.filter((c) => c.name || c.phone || c.email),
    };
    const req = this.editingId
      ? this.api.put(`/clients/${this.editingId}`, payload)
      : this.api.post('/clients', payload);
    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail)),
    });
  }
}
