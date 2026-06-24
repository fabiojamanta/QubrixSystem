import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
<div class="top">
  <div class="page-head">
    @if (logoSrc) {
      <img class="page-logo" [src]="logoSrc" [alt]="logoAlt || title" />
    }
    <div class="page-title">
      <h1 class="title-gradient">{{ title }}</h1>
      @if (description) {
        <p>{{ description }}</p>
      }
    </div>
  </div>
  <ng-content />
</div>
`,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() description = '';
  @Input() logoSrc = '';
  @Input() logoAlt = '';
}
