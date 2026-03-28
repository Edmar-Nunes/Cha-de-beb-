// auth.js — Sistema de autenticação com Supabase + notificação ao admin

const SUPABASE_URL = 'https://dghwfnustgwjeydcandg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaHdmbnVzdGd3amV5ZGNhbmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjAzOTEsImV4cCI6MjA5MDIzNjM5MX0.oJb3kXq-2AAZRnmlCauTJsqQt2R4CHIcnpwM5u0re44';

let supabase = null;
let usuarioAtual = null;

// ─── Inicialização ────────────────────────────────────────────────────────────

async function initAuth() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    usuarioAtual = session.user;
    await carregarPerfil();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      usuarioAtual = session.user;
      await carregarPerfil();
      window.dispatchEvent(new CustomEvent('auth:login', { detail: usuarioAtual }));
    } else if (event === 'SIGNED_OUT') {
      usuarioAtual = null;
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  });

  return supabase;
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

async function carregarPerfil() {
  if (!usuarioAtual) return null;

  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('user_id', usuarioAtual.id)
    .single();

  if (!error && data) {
    usuarioAtual.perfil = data;
  }

  return usuarioAtual?.perfil || null;
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(email, senha) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) throw error;

    usuarioAtual = data.user;
    await carregarPerfil();

    return { success: true, user: usuarioAtual };
  } catch (error) {
    return { success: false, error: traduzirErro(error.message) };
  }
}

// ─── Cadastro ─────────────────────────────────────────────────────────────────

async function cadastrar(nome, email, telefone, senha) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome, telefone, tipo: 'usuario' }
      }
    });

    if (error) throw error;

    usuarioAtual = data.user;
    await carregarPerfil();

    return { success: true, user: usuarioAtual };
  } catch (error) {
    return { success: false, error: traduzirErro(error.message) };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (!error) usuarioAtual = null;
  return { success: !error, error: error?.message };
}

// ─── Getters ──────────────────────────────────────────────────────────────────

function isLoggedIn() { return usuarioAtual !== null; }
function isAdmin() { return usuarioAtual?.perfil?.tipo === 'admin'; }
function getUser() { return usuarioAtual; }

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session) {
    usuarioAtual = data.user;
    await carregarPerfil();
  }
  return { success: !error, error: error?.message };
}

// ─── Notificação ao Admin ─────────────────────────────────────────────────────
//
// Chama a Edge Function "notify-admin" que envia e-mail via Resend/SendGrid.
// Se a Edge Function não estiver configurada, o erro é silencioso — não bloqueia
// o fluxo do usuário.

async function notificarAdmin(payload) {
  try {
    const token = await getToken();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[notificarAdmin] Edge Function error:', err);
    }
  } catch (e) {
    // Silencioso — não interrompe o fluxo principal
    console.warn('[notificarAdmin] Falha ao notificar admin:', e.message);
  }
}

// ─── Escolha de presente com notificação ─────────────────────────────────────

async function registrarEscolha({ presenteId, tipo, valor, mensagem }) {
  const user = getUser();
  if (!user) return { success: false, error: 'Usuário não autenticado' };

  const escolha = {
    presente_id: presenteId,
    usuario_id: user.id,
    tipo_pagamento: tipo,
    quantidade: 1,
    ...(valor ? { valor } : {}),
    ...(mensagem ? { mensagem } : {})
  };

  const { error } = await supabase.from('escolhas').insert(escolha);
  if (error) return { success: false, error: traduzirErro(error.message) };

  // Buscar título do presente para o e-mail
  const { data: presente } = await supabase
    .from('presentes')
    .select('titulo, preco')
    .eq('id', presenteId)
    .single();

  // Notificação assíncrona ao admin (não bloqueia)
  notificarAdmin({
    tipo: 'nova_escolha',
    convidado: {
      nome: user.perfil?.nome || user.email,
      email: user.email,
      telefone: user.perfil?.telefone || null
    },
    presente: {
      titulo: presente?.titulo || 'Presente',
      preco: presente?.preco || null
    },
    pagamento: {
      tipo,
      valor: valor || presente?.preco || null
    },
    mensagem: mensagem || null,
    data: new Date().toISOString()
  });

  return { success: true };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function traduzirErro(msg) {
  const erros = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
    'signup requires a valid password': 'Senha inválida.'
  };
  return erros[msg] || msg;
}
