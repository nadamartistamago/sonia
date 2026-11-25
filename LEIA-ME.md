# Son.IA

Intérprete de sonhos criada por Nadam Guerra.

- `index.html`: o site (páginas, cadastro e consulta).
- `api/sonia.js`: servidor da consulta (Claude Haiku 5.5). As instruções da Son.IA estão na função `instrucoes`.
- `api/cadastro.js`: cadastro (nome, e-mail, WhatsApp), enviado ao Hotmart Send.

Variáveis no Vercel (Settings, Environment Variables):

- `ANTHROPIC_API_KEY`: chave da API do Claude.
- `HOTMART_SEND_URL` e `HOTMART_SEND_TOKEN`: integração do Hotmart Send para receber dados.

Depois de mudar uma variável, publique de novo (Deployments, Redeploy) ou faça qualquer alteração neste repositório.
