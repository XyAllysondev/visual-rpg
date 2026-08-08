// REACT_APP_API_URL = URL base do backend na Vercel (ex: https://api.playnexusrpg.com).
// Vazio em dev local → as chamadas caem em caminho relativo do próprio host.
const API_BASE = process.env.REACT_APP_API_URL || '';

/* ── Criação de cobrança PIX ── */
export const createPixPayment = async (userId, userEmail) => {
  const res = await fetch(`${API_BASE}/api/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userEmail, planName: 'ordem' }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro ao gerar PIX'); }
  return res.json();
};
