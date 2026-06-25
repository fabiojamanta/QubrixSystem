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
  selector: 'app-info-board',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, PageHeaderComponent, FormModalComponent],
  providers: [DateBrPipe],
  template: `
<app-page-header title="Quadro de Informações" description="Comunicados relevantes para a equipe (exibidos no dashboard).">
  @if(auth.isManagement()){ <button type="button" class="btn" (click)="openNew()">Nova informação</button> }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="editingId ? 'Editar' : 'Nova informação'" (close)="closeModal()">
  <div class="grid grid-2">
    <div><label>Título</label><input [(ngModel)]="form.title"></div>
    <div><label>Início</label><input type="date" [(ngModel)]="form.start_date"></div>
    <div><label>Fim</label><input type="date" [(ngModel)]="form.end_date"></div>
    <div class="grid-span-full"><label>Conteúdo</label><textarea [(ngModel)]="form.content"></textarea></div>
    <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
  </div>
</app-form-modal>

<div class="card table-wrap"><table><thead><tr><th>Título</th><th>Vigência</th><th>Conteúdo</th></tr></thead>
<tbody>@for(i of rows; track i.id){<tr [class.clickable]="auth.isManagement()" (click)="auth.isManagement() && edit(i)"><td>{{i.title}}</td><td>{{ formatRange(i) }}</td><td>{{i.content}}</td></tr>} @empty {<tr><td colspan="3" class="empty">Nenhuma informação.</td></tr>}</tbody></table></div>`,
})
export class InfoBoardComponent implements OnInit {
  rows: any[] = [];
  modalOpen = false;
  editingId: number | null = null;
  error = '';
  form: any = { title: '', content: '', start_date: '', end_date: '', active: true };
  constructor(public auth: AuthService, private api: ApiService, private dateBr: DateBrPipe) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/info-board').subscribe({ next: (r) => (this.rows = r), error: (e) => (this.error = formatApiError(e.error?.detail)) }); }
  formatRange(row: any) {
    if (!row.start_date && !row.end_date) return 'Sem prazo';
    const start = row.start_date ? this.dateBr.transform(row.start_date) : '—';
    const end = row.end_date ? this.dateBr.transform(row.end_date) : '—';
    return `${start} — ${end}`;
  }
  openNew() { this.form = { title: '', content: '', start_date: '', end_date: '', active: true }; this.editingId = null; this.modalOpen = true; }
  edit(row: any) { this.form = { ...row, start_date: row.start_date || '', end_date: row.end_date || '' }; this.editingId = row.id; this.modalOpen = true; }
  closeModal() { this.modalOpen = false; }
  save() {
    const payload = {
      ...this.form,
      start_date: this.form.start_date || null,
      end_date: this.form.end_date || null,
    };
    const req = this.editingId ? this.api.put(`/info-board/${this.editingId}`, payload) : this.api.post('/info-board', payload);
    req.subscribe({ next: () => { this.closeModal(); this.load(); }, error: (e) => (this.error = formatApiError(e.error?.detail)) });
  }
}
