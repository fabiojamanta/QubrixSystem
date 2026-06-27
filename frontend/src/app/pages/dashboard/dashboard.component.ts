import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { PAGE_LOGOS } from '../../shared/page-logos';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DateBrPipe, PageHeaderComponent],
  template: `
<app-page-header title="Dashboard" description="Campanhas, vendas, propostas e validade de estoque." [logoSrc]="logo" logoAlt="Dashboard" />
@if(!data){<p class="empty">Carregando...</p>}
@if(data){
  <section class="card dash-panel">
    <h3 class="dash-section-title">Campanhas</h3>
    @for (c of data.campaigns; track c.id) {
      <div class="dash-item" [class.dash-item-ok]="!c.is_early_notice" [class.dash-item-warn]="c.is_early_notice">
        <div class="dash-product-name">{{ c.title }}</div>
        <div class="dash-details">
          @if(c.is_early_notice){
            <div class="dash-detail-line">Aviso: campanha inicia em {{ c.starts_in_days }} dia(s)</div>
          }
          <div class="dash-detail-line">{{ c.description }}</div>
          <div class="dash-detail-line">Preços especiais: {{ c.special_price_info || '—' }}</div>
          <div class="dash-detail-line">Vigência: {{ c.start_date | dateBr }} — {{ c.end_date | dateBr }}</div>
        </div>
      </div>
    } @empty { <p class="empty">Nenhuma campanha ativa.</p> }
  </section>

  <div class="grid grid-2">
    <section class="card dash-panel">
      <h3 class="dash-section-title">Vendas</h3>
      <div class="grid grid-2">
        <div class="card stat"><b>{{ data.sales_summary.month_total | currency:'BRL' }}</b><span>Mês atual</span></div>
        <div class="card stat"><b>{{ data.sales_summary.last_year_same_period | currency:'BRL' }}</b><span>Mesmo período ano anterior</span></div>
      </div>
      @for (m of data.sales_summary.last_3_months; track m.month) {
        <div class="dash-item dash-item-ok">
          <div class="dash-product-name">{{ m.month }}</div>
          <div class="dash-detail-line">{{ m.total | currency:'BRL' }}</div>
        </div>
      }
    </section>

    <section class="card dash-panel dash-panel-compact">
      <h3 class="dash-section-title">Informações para a equipe</h3>
      @for (i of data.info_board; track i.id) {
        <div class="dash-item dash-item-ok dash-item-compact">
          <div class="dash-product-name">{{ i.title }}</div>
          <div class="dash-details">
            <div class="dash-detail-line">{{ i.content }}</div>
            @if(i.start_date || i.end_date){
              <div class="dash-detail-line">Vigência: {{ i.start_date | dateBr }} — {{ i.end_date | dateBr }}</div>
            }
          </div>
        </div>
      } @empty { <p class="empty">Nenhuma informação publicada.</p> }
    </section>
  </div>

  <div class="grid grid-2">
    <section class="card dash-panel">
      <h3 class="dash-section-title">Propostas (30 dias)</h3>
      <div class="grid grid-3">
        <div class="card stat"><b>{{ data.quotes_summary.generated_30_days }}</b><span>Geradas</span></div>
        <div class="card stat"><b>{{ data.quotes_summary.open_without_finish }}</b><span>Abertas</span></div>
        <div class="card stat"><b>{{ data.quotes_summary.expired_lost }}</b><span>Perdidas</span></div>
      </div>
      <h4>Motivos de perda</h4>
      @for (reason of lostReasons; track reason.key) {
        <div class="dash-item">
          <div class="dash-product-name">{{ reason.label }}</div>
          <div class="dash-detail-line">{{ data.quotes_summary.lost_by_reason[reason.key] || 0 }} ({{ pct(reason.key) }}%)</div>
          <div class="bar-track"><div class="bar-fill" [style.width.%]="pct(reason.key)"></div></div>
        </div>
      }
    </section>

    <section class="card dash-panel">
      <h3 class="dash-section-title">Validade de produtos</h3>
      <div class="grid grid-3">
        <div class="card stat"><b>{{ data.expiry_alerts[30] }}</b><span>&lt; 30 dias</span></div>
        <div class="card stat"><b>{{ data.expiry_alerts[90] }}</b><span>&lt; 90 dias</span></div>
        <div class="card stat"><b>{{ data.expiry_alerts[180] }}</b><span>&lt; 180 dias</span></div>
      </div>
      @for (item of data.expiry_items; track item.id) {
        <div class="dash-item dash-item-compact"
          [class.dash-item-danger]="item.bucket === 30"
          [class.dash-item-warn]="item.bucket === 90"
          [class.dash-item-ok]="item.bucket === 180">
          <div class="dash-product-name">{{ item.short_description }}</div>
          <div class="dash-details">
            <div class="dash-detail-line">Código: {{ item.code }} · Lote: {{ item.lot_number }} · Qtd: {{ item.quantity }}</div>
            <div class="dash-detail-line">Validade: {{ item.expiry_date | dateBr }} ({{ item.days_until_expiry }} dia(s))</div>
          </div>
        </div>
      } @empty { <p class="empty">Nenhum produto com validade próxima.</p> }
    </section>
  </div>
}`,
  styles: [`
    .bar-track{height:8px;background:rgba(0,0,0,.08);border-radius:999px;overflow:hidden;margin-top:6px}
    .bar-fill{height:100%;background:var(--brand)}
    .dash-panel-compact .dash-section-title { margin-bottom: 10px; }
    .dash-item-compact { padding: 8px 10px; margin-bottom: 8px; }
    .dash-item-compact .dash-product-name { font-size: 14px; }
    .dash-item-compact .dash-details { margin-top: 4px; margin-left: 0.75rem; }
    .dash-item-compact .dash-detail-line { font-size: 12px; }
  `],
})
export class DashboardComponent implements OnInit {
  logo = PAGE_LOGOS.dashboard;
  data: any;
  lostReasons = [
    { key: 'preco', label: 'Preço' },
    { key: 'prazo_entrega', label: 'Prazo de entrega' },
    { key: 'prazo_pagamento', label: 'Prazo de pagamento' },
    { key: 'outra_marca', label: 'Preferência por outra marca' },
    { key: 'ma_fe', label: 'Má fé' },
    { key: 'outro', label: 'Outro' },
  ];
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.get<any>('/dashboard').subscribe((d) => (this.data = d)); }
  pct(key: string) {
    const total = this.data?.quotes_summary?.expired_lost || 0;
    if (!total) return 0;
    return Math.round(((this.data.quotes_summary.lost_by_reason[key] || 0) / total) * 100);
  }
}
