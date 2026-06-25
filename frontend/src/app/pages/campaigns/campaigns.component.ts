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
<div class="grid grid-2 card filters">
  <div><label>Vigência a partir de</label><input type="date" [(ngModel)]="filterFrom" (ngModelChange)="load()"></div>
  <div><label>Vigência até</label><input type="date" [(ngModel)]="filterTo" (ngModelChange)="load()"></div>
</div>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar campanha' : 'Nova campanha'" (close)="closeModal()">
  <div class="grid grid-2">
    <div><label>Título</label><input [(ngModel)]="form.title"></div>
    <div><label>Preços especiais</label><input [(ngModel)]="form.special_price_info"></div>
    <div><label>Início</label><input type="date" [(ngModel)]="form.start_date"></div>
    <div><label>Fim</label><input type="date" [(ngModel)]="form.end_date"></div>
    <div class="campaign-notice-row grid-span-full">
      <label class="form-toggle campaign-notice-toggle">
        <input type="checkbox" [(ngModel)]="form.show_early_notice">
        <span class="form-toggle-copy">
          <span class="form-toggle-title">Mostrar aviso antes do início</span>
          <span class="form-toggle-desc">Exibe a campanha no dashboard alguns dias antes da data de início.</span>
        </span>
      </label>
      @if(form.show_early_notice){
        <div class="campaign-notice-days">
          <label>Dias antes</label>
          <input type="number" min="1" [(ngModel)]="form.early_notice_days">
        </div>
      }
    </div>
    <div class="grid-span-full"><label>Descrição</label><textarea [(ngModel)]="form.description"></textarea></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Título</th><th>Vigência</th><th>Aviso antecipado</th><th>Preços especiais</th></tr></thead>
<tbody>@for(c of rows; track c.id){<tr [class.clickable]="auth.isManagement()" (click)="auth.isManagement() && edit(c)"><td>{{c.title}}</td><td>{{c.start_date|dateBr}} — {{c.end_date|dateBr}}</td><td>@if(c.show_early_notice){ {{ c.early_notice_days }} dia(s) antes } @else { — }</td><td>{{c.special_price_info||'-'}}</td></tr>} @empty {<tr><td colspan="4" class="empty">Nenhuma campanha.</td></tr>}</tbody></table></div>`,
  styles: [`
    .campaign-notice-row {
      display: flex;
      gap: 12px;
      align-items: stretch;
    }
    .campaign-notice-toggle {
      flex: 1;
      min-width: 0;
      margin-bottom: 12px;
    }
    .campaign-notice-days {
      width: 108px;
      flex-shrink: 0;
    }
    .campaign-notice-days input {
      margin-bottom: 0;
      text-align: center;
    }
    @media (max-width: 640px) {
      .campaign-notice-row { flex-direction: column; }
      .campaign-notice-days { width: 100%; }
    }
  `],
})
export class CampaignsComponent implements OnInit {
  rows: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  filterFrom = '';
  filterTo = '';
  form: any = this.emptyForm();
  constructor(public auth: AuthService, private api: ApiService) {}
  ngOnInit() { this.load(); }
  emptyForm() {
    return {
      title: '',
      description: '',
      special_price_info: '',
      start_date: '',
      end_date: '',
      show_early_notice: false,
      early_notice_days: null,
      active: true,
    };
  }
  load() {
    this.api.get<any[]>('/campaigns', { date_from: this.filterFrom || null, date_to: this.filterTo || null })
      .subscribe({ next: (r) => (this.rows = r), error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
  openNew() { this.form = this.emptyForm(); this.editingId = null; this.modalOpen = true; }
  edit(row: any) { this.form = { ...row }; this.editingId = row.id; this.modalOpen = true; }
  closeModal() { this.modalOpen = false; }
  save() {
    const payload = {
      ...this.form,
      early_notice_days: this.form.show_early_notice ? Number(this.form.early_notice_days) : null,
    };
    const req = this.editingId ? this.api.put(`/campaigns/${this.editingId}`, payload) : this.api.post('/campaigns', payload);
    req.subscribe({ next: () => { this.closeModal(); this.load(); }, error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
}
