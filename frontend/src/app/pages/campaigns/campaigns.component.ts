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
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent, FormModalComponent],
  template: `
<app-page-header title="Campanhas" description="Campanhas promocionais exibidas no dashboard.">
  @if(auth.isManagement()){ <button type="button" class="btn" (click)="openNew()">Nova campanha</button> }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar campanha' : 'Nova campanha'" (close)="closeModal()">
  <div class="grid grid-2">
    <div><label>Título</label><input [(ngModel)]="form.title"></div>
    <div><label>Preços especiais</label><input [(ngModel)]="form.special_price_info"></div>
    <div><label>Início</label><input type="date" [(ngModel)]="form.start_date"></div>
    <div><label>Fim</label><input type="date" [(ngModel)]="form.end_date"></div>
    <div class="grid-span-2"><label>Descrição</label><textarea [(ngModel)]="form.description"></textarea></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Título</th><th>Vigência</th><th>Preços especiais</th></tr></thead>
<tbody>@for(c of rows; track c.id){<tr [class.clickable]="auth.isManagement()" (click)="auth.isManagement() && edit(c)"><td>{{c.title}}</td><td>{{c.start_date|dateBr}} — {{c.end_date|dateBr}}</td><td>{{c.special_price_info||'-'}}</td></tr>} @empty {<tr><td colspan="3" class="empty">Nenhuma campanha.</td></tr>}</tbody></table></div>`,
})
export class CampaignsComponent implements OnInit {
  rows: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = { title:'', description:'', special_price_info:'', start_date:'', end_date:'', active:true };
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/campaigns').subscribe({ next:(r)=>this.rows=r, error:e=>this.error=formatApiError(e.error?.detail) }); }
  openNew() { this.form={ title:'', description:'', special_price_info:'', start_date:'', end_date:'', active:true }; this.editingId=null; this.modalOpen=true; }
  edit(row:any) { this.form={...row}; this.editingId=row.id; this.modalOpen=true; }
  closeModal() { this.modalOpen=false; }
  save() {
    const req = this.editingId ? this.api.put(`/campaigns/${this.editingId}`, this.form) : this.api.post('/campaigns', this.form);
    req.subscribe({ next:()=>{ this.closeModal(); this.load(); }, error:e=>this.error=formatApiError(e.error?.detail) });
  }
}
