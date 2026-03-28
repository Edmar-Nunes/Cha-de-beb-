// auth.js - Sistema de autenticação com token e refresh automático

const SUPABASE_URL = 'https://dghwfnustgwjeydcandg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaHdmbnVzdGd3amV5ZGNhbmRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjAzOTEsImV4cCI6MjA5MDIzNjM5MX0.oJb3kXq-2AAZRnmlCauTJsqQt2R4CHIcnpwM5u0re44';

let supabase = null;
let usuarioAtual = null;

// Inicializar cliente Supabase
async function initAuth() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });
  
  // Verificar sessão existente
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    usuarioAtual = session.user;
    await carregarPerfil();
  }
  
  // Escutar mudanças de autenticação
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

// Carregar perfil do usuário
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
  
  return usuarioAtual.perfil;
}

// Login com email e senha
async function login(email, senha) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha
    });
    
    if (error) throw error;
    
    usuarioAtual = data.user;
    await carregarPerfil();
    
    return { success: true, user: usuarioAtual };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Cadastro de novo usuário
async function cadastrar(nome, email, telefone, senha) {
  try {
    // Criar usuário no Auth
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: senha,
      options: {
        data: {
          nome: nome,
          telefone: telefone,
          tipo: 'usuario'
        }
      }
    });
    
    if (error) throw error;
    
    // O perfil será criado automaticamente pelo trigger do banco
    usuarioAtual = data.user;
    await carregarPerfil();
    
    return { success: true, user: usuarioAtual };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logout
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    usuarioAtual = null;
  }
  return { success: !error, error: error?.message };
}

// Verificar se usuário está logado
function isLoggedIn() {
  return usuarioAtual !== null;
}

// Verificar se é admin
function isAdmin() {
  return usuarioAtual?.perfil?.tipo === 'admin';
}

// Obter usuário atual
function getUser() {
  return usuarioAtual;
}

// Obter token JWT atual
async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// Forçar refresh do token (chamado automaticamente)
async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session) {
    usuarioAtual = data.user;
    await carregarPerfil();
  }
  return { success: !error, error: error?.message };
}