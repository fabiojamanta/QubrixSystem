import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-form-modal',
  standalone: true,
  template: `
@if (open) {
  <div class="modal-backdrop" (click)="close.emit()" role="presentation">
    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="dialogId"
      (click)="$event.stopPropagation()"
    >
      <div class="modal-header">
        <h2 class="modal-title" [id]="dialogId">{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="close.emit()">×</button>
      </div>
      <div class="modal-body">
        <ng-content />
      </div>
    </div>
  </div>
}`,
})
export class FormModalComponent {
  private static seq = 0;
  @Input() open = false;
  @Input() title = '';
  @Output() close = new EventEmitter<void>();
  readonly dialogId = `form-modal-${++FormModalComponent.seq}`;
}
