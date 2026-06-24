import { Pipe, PipeTransform } from '@angular/core';

const TZ_BR = 'America/Sao_Paulo';
const LOCALE_BR = 'pt-BR';

/** Formata datas/horas para exibição em pt-BR (fuso de Brasília). Não altera valores da API. */
@Pipe({ name: 'dateBr', standalone: true })
export class DateBrPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, mode: 'date' | 'datetime' = 'date'): string {
    if (value == null || value === '') return '';
    const date = this.parseToDate(value);
    if (!date || Number.isNaN(date.getTime())) return String(value);

    if (mode === 'datetime') {
      return new Intl.DateTimeFormat(LOCALE_BR, {
        timeZone: TZ_BR,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date);
    }

    return new Intl.DateTimeFormat(LOCALE_BR, {
      timeZone: TZ_BR,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private parseToDate(value: string | Date): Date | null {
    if (value instanceof Date) return value;
    const s = String(value).trim();

    // Apenas data (yyyy-MM-dd) — meia-noite em Brasília
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T00:00:00-03:00`);
    }

    // Data e hora sem fuso — assume Brasília
    const naive = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/);
    if (naive && !/[Zz]$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
      const time = naive[2].length === 5 ? `${naive[2]}:00` : naive[2];
      return new Date(`${naive[1]}T${time}-03:00`);
    }

    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
