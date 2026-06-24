type ValidationError = {
  msg?: string;
  loc?: (string | number)[];
  type?: string;
  ctx?: Record<string, unknown>;
};

const FIELD_LABELS: Record<string, string> = {
  password: 'Senha',
  email: 'E-mail',
  name: 'Nome',
  phone: 'Telefone',
  profile_id: 'Perfil',
  slug: 'Slug',
  product_id: 'Produto',
  client_id: 'Cliente',
  patient_id: 'Paciente',
  supplier_id: 'Fornecedor',
  lot_id: 'Lote',
  lot_number: 'Lote',
  quantity: 'Quantidade',
  barcode: 'Código de barras',
  document: 'Documento',
  client_type: 'Tipo de cliente',
  product_type: 'Tipo de produto',
  scheduled_date: 'Data prevista',
  total_amount: 'Valor total',
  medications: 'Medicamentos',
  total_sessions: 'Total de sessões',
  signature: 'Assinatura',
  pin: 'PIN',
};

function fieldLabel(loc?: (string | number)[]): string {
  if (!loc?.length) return '';
  const key = String(loc[loc.length - 1]);
  return FIELD_LABELS[key] ?? key;
}

function validationMessage(err: ValidationError): string {
  const field = fieldLabel(err.loc);
  const prefix = field ? `${field}: ` : '';

  if (err.type === 'string_too_short' && typeof err.ctx?.['min_length'] === 'number') {
    return `${prefix}deve ter no mínimo ${err.ctx['min_length']} caracteres`;
  }
  if (err.type === 'string_too_long' && typeof err.ctx?.['max_length'] === 'number') {
    return `${prefix}deve ter no máximo ${err.ctx['max_length']} caracteres`;
  }
  if (err.type === 'missing' || err.type === 'value_error.missing') {
    return `${prefix}campo obrigatório`;
  }
  if (err.type === 'value_error.email' || (err.type === 'string_type' && err.msg?.includes('email'))) {
    return `${prefix}formato de e-mail inválido`;
  }
  if (err.type === 'int_parsing' || err.type === 'float_parsing') {
    return `${prefix}valor numérico inválido`;
  }
  if (err.type === 'greater_than' && typeof err.ctx?.['gt'] === 'number') {
    return `${prefix}deve ser maior que ${err.ctx['gt']}`;
  }
  if (err.type === 'greater_than_equal' && typeof err.ctx?.['ge'] === 'number') {
    return `${prefix}deve ser no mínimo ${err.ctx['ge']}`;
  }
  if (err.type === 'value_error' && err.msg) {
    return `${prefix}${err.msg.replace(/^Value error,\s*/i, '')}`;
  }
  if (err.msg) return `${prefix}${err.msg}`;
  return prefix || 'Dados inválidos';
}

export function formatApiError(detail: unknown, fallback = 'Erro na operação'): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === 'object' ? validationMessage(item as ValidationError) : String(item),
      )
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  if (detail && typeof detail === 'object' && 'msg' in detail) {
    return validationMessage(detail as ValidationError);
  }
  return fallback;
}
