// Son.IA · cadastro (Vercel)
// Recebe nome, e-mail e WhatsApp, envia o contato para o Hotmart Send
// e devolve uma "chave de acesso" assinada que libera as consultas neste aparelho.
const crypto = require("crypto");

function segredo() {
  // Derivado da chave da API: não exige configurar outro segredo.
  return crypto.createHash("sha256").update("sonia-cadastro:" + (process.env.ANTHROPIC_API_KEY || "")).digest();
}
function assinar(email) {
  const dados = Buffer.from(JSON.stringify({ e: email, t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", segredo()).update(dados).digest("base64url");
  return dados + "." + sig;
}

// Limite simples por visitante: no máximo 5 cadastros a cada hora.
const janela = 60 * 60 * 1000, porIP = 5, registro = new Map();
function permitido(ip) {
  const agora = Date.now();
  const lista = (registro.get(ip) || []).filter(t => agora - t < janela);
  if (lista.length >= porIP) { registro.set(ip, lista); return false; }
  lista.push(agora); registro.set(ip, lista);
  if (registro.size > 5000) registro.clear();
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ erro: "Método não permitido." }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ erro: "Son.IA ainda não foi configurada." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (!permitido(ip)) return res.status(429).json({ erro: "Muitas tentativas seguidas. Tente de novo mais tarde." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const nome = String(body.nome || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const whatsapp = String(body.whatsapp || "").trim().slice(0, 40);
  if (!nome) return res.status(400).json({ erro: "Escreva seu nome." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "Confira o e-mail." });
  if (whatsapp.replace(/\D/g, "").length < 10) return res.status(400).json({ erro: "Confira o WhatsApp, com DDD." });
  if (body.aceite !== true) return res.status(400).json({ erro: "Para continuar, marque a caixa de concordância." });

  // Envia o contato para o Hotmart Send (integração "Para receber dados").
  const url = process.env.HOTMART_SEND_URL, hottok = process.env.HOTMART_SEND_TOKEN;
  if (url && hottok) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hottok, email, name: nome, phone: whatsapp }),
      });
      if (!r.ok) console.error("Hotmart Send recusou", r.status, (await r.text().catch(() => "")).slice(0, 300), JSON.stringify({ nome, email, whatsapp }));
    } catch (e) {
      console.error("Falha ao enviar ao Hotmart Send", String(e), JSON.stringify({ nome, email, whatsapp }));
    }
  } else {
    // Sem integração configurada: o contato fica registrado nos logs do Vercel.
    console.log("Cadastro (Hotmart Send não configurado)", JSON.stringify({ nome, email, whatsapp }));
  }

  return res.status(200).json({ token: assinar(email) });
};
