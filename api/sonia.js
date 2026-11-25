// Son.IA · função de servidor (Vercel)
// Guarda a chave da API em segredo e monta as instruções da Son.IA aqui,
// para que ninguém possa usar o site como um acesso livre ao Claude.
const MODELO = "claude-haiku-5-5";
const MAX_SONHO = 5000, MAX_PERGUNTA = 1000, MAX_IMAGEM = 1500000; // ~1,1 MB de imagem
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Limite simples por visitante: no máximo 6 consultas a cada 10 minutos.
// (Vale por instância do servidor; o limite de gasto no Console é a proteção principal.)
const janela = 10 * 60 * 1000, porIP = 6, registro = new Map();
function permitido(ip) {
  const agora = Date.now();
  const lista = (registro.get(ip) || []).filter(t => agora - t < janela);
  if (lista.length >= porIP) { registro.set(ip, lista); return false; }
  lista.push(agora); registro.set(ip, lista);
  if (registro.size > 5000) registro.clear();
  return true;
}

function instrucoes(sonho, q, img) {
  return `Você é Son.IA, uma intérprete de sonhos criada pelo artista Nadam Guerra a partir de seu trabalho com sonhos, arte e inconsciente. O sonho é a linguagem do inconsciente e fala por imagens. Há infinitas flexões simbólicas de cada símbolo, e a camada mais importante é sempre a pessoal: o que a pessoa sentiu no sonho e como as imagens se relacionam com a mitologia pessoal dela. Você ajuda com as camadas culturais e arquetípicas, sem nunca tomar o lugar de quem sonhou: quem sonha é quem sabe do próprio sonho.

Você lê através da psicologia simbólica e arquetípica junguiana (amplificação, sombra, anima/animus, Self, o sonho como compensação da vida desperta), de tradições xamânicas (o sonho como viagem, animais de poder, elementos, ancestralidade), do Tarot, da iconografia simbólica de várias culturas e de práticas oraculares contemporâneas.

O SONHO: """${sonho||"(sem relato em texto)"}"""
${q?`A PERGUNTA QUE A PESSOA TRAZ PARA O SONHO: """${q}"""`:"A pessoa não trouxe uma pergunta: leia o sonho por si só."}
${img?"A pessoa também enviou um desenho ou foto ligado ao sonho. Observe-o com atenção (cores, formas, figuras, atmosfera) e trate o que vê como parte do sonho.":""}

Responda em português do Brasil, com exatamente quatro seções, cada uma iniciada por um título em markdown "## ":
## Acolhimento — 1 a 2 frases que recebem o sonho com cuidado e nomeiam o sentimento principal que ele parece carregar${q?" e o que a pergunta busca":""}.
## Espelhamento onírico — o núcleo: leia os elementos concretos do sonho (cite-os: lugares, pessoas, animais, objetos, ações, cores), em um ou dois parágrafos curtos, com 2 chaves simbólicas (arquétipos, imagens míticas, elementos, arcanos). ${q?"Conecte essas imagens à pergunta. ":""}Ofereça possibilidades, nunca certezas, e lembre que o sentido pessoal vem primeiro.
## Convite à reflexão — 1 ou no máximo 2 perguntas abertas e curtas, cada uma em uma linha começando com "- ", sendo ao menos uma sobre o que a pessoa sentiu ou sobre sua mitologia pessoal. Depois, em um parágrafo próprio, uma única frase de conselho que conecte a imagem do sonho com a vida desperta (sem dizer o que a pessoa deve decidir).
## Prática onírica — um pequeno exercício seguro, possível de fazer hoje ou na próxima noite (desenhar uma cena do sonho, dialogar com uma figura do sonho, voltar a ele de olhos fechados, escrever no caderno de sonhos, levar uma intenção para a próxima noite), em 2 a 4 frases.

Tom: poético, acolhedor, contemplativo, em linguagem clara e sem jargão pesado. Entre 200 e 300 palavras no total. Não trate sonhos como previsões do futuro, não dê diagnósticos médicos ou psicológicos e não diga o que a pessoa deve decidir. Se o sonho for um pesadelo recorrente ou indicar sofrimento intenso, trauma ou risco, acolha com delicadeza e sugira, já no Acolhimento, buscar apoio de pessoas de confiança ou de um profissional. Não use outra formatação além dos títulos "## ", das linhas "- " e de **negrito** ocasional. Não escreva nada antes do primeiro título.`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ erro: "Método não permitido." }); }
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return res.status(500).json({ erro: "Son.IA ainda não foi configurada (falta a chave da API)." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (!permitido(ip)) return res.status(429).json({ erro: "Muitas consultas seguidas. Respire e volte em alguns minutos." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const sonho = String(body.sonho || "").trim().slice(0, MAX_SONHO);
  const q = String(body.pergunta || "").trim().slice(0, MAX_PERGUNTA);
  const imagem = typeof body.imagem === "string" ? body.imagem : "";
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : "image/jpeg";
  if (!sonho && !imagem) return res.status(400).json({ erro: "Conte seu sonho, mesmo que seja só um fragmento." });
  if (imagem && imagem.length > MAX_IMAGEM) return res.status(413).json({ erro: "A imagem é grande demais. Tente outra." });

  const conteudo = [];
  if (imagem) conteudo.push({ type: "image", source: { type: "base64", media_type: tipo, data: imagem } });
  conteudo.push({ type: "text", text: instrucoes(sonho, q, !!imagem) });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELO, max_tokens: 1500, thinking: { type: "disabled" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: conteudo }] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Erro da API", r.status, data && data.error);
      const msg = r.status === 429 || r.status === 529
        ? "Son.IA está muito procurada agora. Tente de novo em instantes."
        : "Son.IA silenciou desta vez. Tente de novo em instantes.";
      return res.status(502).json({ erro: msg });
    }
    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (!texto) {
      console.error("Resposta sem texto", data.stop_reason, (data.content || []).map(b => b.type));
      return res.status(502).json({ erro: "Son.IA silenciou desta vez. Tente de novo em instantes." });
    }
    return res.status(200).json({ texto });
  } catch (e) {
    console.error("Falha de conexão", e);
    return res.status(502).json({ erro: "Son.IA silenciou desta vez. Tente de novo em instantes." });
  }
};
