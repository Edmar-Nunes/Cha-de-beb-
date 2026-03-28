// supabase/functions/notify-admin/index.ts
// Edge Function — Notifica o admin por e-mail quando um convidado escolhe um presente.
//
// Deploy:
//   supabase functions deploy notify-admin
//
// Variáveis de ambiente necessárias (defina no Supabase Dashboard → Settings → Edge Functions):
//   RESEND_API_KEY   — chave da API do Resend (https://resend.com)
//   ADMIN_EMAIL      — e-mail do administrador que receberá as notificações
//   FROM_EMAIL       — e-mail remetente verificado no Resend (ex: noreply@seudominio.com)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')!;
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'Chá de Bebê <noreply@chadebebe.com.br>';

serve(async (req: Request) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { tipo, convidado, presente, pagamento, mensagem, data } = payload as {
    tipo: string;
    convidado: { nome: string; email: string; telefone?: string };
    presente: { titulo: string; preco?: number };
    pagamento: { tipo: string; valor?: number };
    mensagem?: string;
    data: string;
  };

  const dataFormatada = new Date(data).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const valorFormatado = pagamento.valor
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pagamento.valor)
    : '—';

  const tipoPagamento: Record<string, string> = {
    presente: '🎁 Compra do presente',
    pix: '💰 Contribuição via PIX',
    dinheiro: '💵 Dinheiro'
  };

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Georgia, serif; background: #fdf8f0; margin: 0; padding: 20px; }
    .card {
      background: white;
      border-radius: 16px;
      max-width: 560px;
      margin: 0 auto;
      padding: 36px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 28px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .label { color: #666; font-size: 13px; }
    .value { font-weight: 600; color: #1a1a2e; font-size: 14px; text-align: right; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-pix { background: #d1fae5; color: #059669; }
    .badge-presente { background: #ede9fe; color: #7c3aed; }
    .badge-dinheiro { background: #fef3c7; color: #d97706; }
    .footer { margin-top: 24px; font-size: 12px; color: #aaa; text-align: center; }
    .mensagem { background: #fdf8f0; border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 8px; font-style: italic; color: #555; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎁 Nova Escolha de Presente!</h1>
    <p class="subtitle">Recebida em ${dataFormatada}</p>

    <div class="row">
      <span class="label">👤 Convidado</span>
      <span class="value">${convidado.nome}</span>
    </div>
    <div class="row">
      <span class="label">📧 E-mail</span>
      <span class="value">${convidado.email}</span>
    </div>
    ${convidado.telefone ? `
    <div class="row">
      <span class="label">📱 Telefone</span>
      <span class="value">${convidado.telefone}</span>
    </div>` : ''}
    <div class="row">
      <span class="label">🎁 Presente escolhido</span>
      <span class="value">${presente.titulo}</span>
    </div>
    <div class="row">
      <span class="label">💳 Forma de pagamento</span>
      <span class="value">
        <span class="badge badge-${pagamento.tipo}">
          ${tipoPagamento[pagamento.tipo] ?? pagamento.tipo}
        </span>
      </span>
    </div>
    <div class="row">
      <span class="label">💰 Valor</span>
      <span class="value">${valorFormatado}</span>
    </div>

    ${mensagem ? `
    <div class="mensagem">
      <strong>Mensagem do convidado:</strong><br>${mensagem}
    </div>` : ''}

    <p class="footer">Este e-mail foi gerado automaticamente pelo sistema do Chá de Bebê.</p>
  </div>
</body>
</html>
  `.trim();

  const emailPayload = {
    from: FROM_EMAIL,
    to: [ADMIN_EMAIL],
    subject: `🎁 ${convidado.nome} escolheu um presente — ${presente.titulo}`,
    html
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify(emailPayload)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[notify-admin] Resend error:', err);
    return new Response(JSON.stringify({ error: err }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
