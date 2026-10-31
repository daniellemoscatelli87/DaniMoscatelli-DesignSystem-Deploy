// Versionamento do DM Design System. Usado pelo fluxo .github/workflows/publish.yml.
//
//   node scripts/versionar.mjs planejar     decide o que fazer nesta execução (lê o manifesto e a fonte)
//   node scripts/versionar.mjs comparar <anterior.json> <novo.json> [relatorio.md]
//   node scripts/versionar.mjs registrar <versao> <status> <fonte_sha> <evento> [removidos.json]
//
// Manifesto: versoes/versoes.json
//   atual        versão que está no ar
//   versoes[]    toda versão registrada: { versao, fonte_sha, data, status (publicada|retida), inventario, removidos, adicionados }
//   publicacoes[] histórico do que foi ao ar: { data, versao, evento (nova|aceita|voltou) }
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MANIFESTO = "versoes/versoes.json";
const CATEGORIAS = ["menu_grupos", "menu_itens", "secoes", "ancoras", "componentes", "tokens"];
const NOMES = {
  menu_grupos: "grupos do menu",
  menu_itens: "itens do menu",
  secoes: "seções",
  ancoras: "âncoras de seção",
  componentes: "componentes",
  tokens: "tokens",
};

const lerManifesto = () =>
  existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, "utf8")) : { atual: null, versoes: [], publicacoes: [] };
const gravarManifesto = (m) => writeFileSync(MANIFESTO, JSON.stringify(m, null, 2) + "\n");
const saida = (pares) => {
  for (const [k, v] of Object.entries(pares)) {
    console.log(`${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  }
};
const numero = (versao) => Number(String(versao).replace(/^v/, "")) || 0;

function planejar() {
  const acao = process.env.ACAO || "publicar";
  const aceitar = process.env.ACEITAR_REMOCOES === "true";
  const fonteDir = process.env.FONTE_DIR || "source";
  const manifesto = lerManifesto();
  const fonteSha = execSync(`git -C ${fonteDir} rev-parse HEAD`).toString().trim();

  if (acao === "voltar") {
    const pedida = (process.env.VERSAO_PEDIDA || "").trim();
    const entrada = manifesto.versoes.find((v) => v.versao === pedida);
    if (!entrada) {
      console.error(`Versão "${pedida}" não existe no manifesto. Versões registradas: ${manifesto.versoes.map((v) => v.versao).join(", ") || "nenhuma"}.`);
      process.exit(1);
    }
    saida({ continuar: "true", modo: "voltar", versao: entrada.versao, fonte_sha: entrada.fonte_sha, anterior: manifesto.atual || "" });
    return;
  }

  const ultima = manifesto.versoes.at(-1);
  if (ultima && ultima.fonte_sha === fonteSha) {
    if (ultima.status === "retida" && aceitar) {
      saida({ continuar: "true", modo: "aceitar", versao: ultima.versao, fonte_sha: fonteSha, anterior: manifesto.atual || "" });
      return;
    }
    const motivo =
      ultima.status === "retida"
        ? `${ultima.versao} está retida (houve remoções). Para publicar mesmo assim, rode o fluxo manualmente com "aceitar_remocoes" marcado.`
        : `nada novo: ${ultima.versao} já corresponde ao commit ${fonteSha.slice(0, 7)} da fonte.`;
    console.log(motivo);
    saida({ continuar: "false", modo: "nada", versao: ultima.versao, fonte_sha: fonteSha, anterior: manifesto.atual || "", motivo });
    return;
  }

  const proxima = `v${Math.max(0, ...manifesto.versoes.map((v) => numero(v.versao))) + 1}`;
  saida({ continuar: "true", modo: "nova", versao: proxima, fonte_sha: fonteSha, anterior: manifesto.atual || "" });
}

function diferencas(anterior, novo) {
  const removidos = {};
  const adicionados = {};
  for (const c of CATEGORIAS) {
    const a = new Set(anterior?.[c] || []);
    const n = new Set(novo?.[c] || []);
    removidos[c] = [...a].filter((x) => !n.has(x));
    adicionados[c] = [...n].filter((x) => !a.has(x));
  }
  return { removidos, adicionados };
}

function comparar(args) {
  const [arqAnterior, arqNovo, arqRelatorio] = args;
  const anterior = arqAnterior && existsSync(arqAnterior) ? JSON.parse(readFileSync(arqAnterior, "utf8")) : null;
  const novo = JSON.parse(readFileSync(arqNovo, "utf8"));
  const { removidos, adicionados } = diferencas(anterior, novo);
  const totalRemovidos = Object.values(removidos).reduce((s, l) => s + l.length, 0);
  const totalAdicionados = Object.values(adicionados).reduce((s, l) => s + l.length, 0);

  const linhas = [];
  if (!anterior) {
    linhas.push("Primeira versão registrada: não há versão anterior para comparar.");
  } else {
    linhas.push(`Comparação com a versão no ar: **${totalRemovidos} removido(s)**, ${totalAdicionados} adicionado(s).`);
    for (const c of CATEGORIAS) {
      if (removidos[c].length) linhas.push(`\n**Sumiram (${NOMES[c]}):**\n` + removidos[c].map((x) => `- ${x}${anterior.rotulos?.[x] ? ` (${anterior.rotulos[x]})` : ""}`).join("\n"));
    }
    for (const c of CATEGORIAS) {
      if (adicionados[c].length) linhas.push(`\n**Entraram (${NOMES[c]}):**\n` + adicionados[c].map((x) => `- ${x}${novo.rotulos?.[x] ? ` (${novo.rotulos[x]})` : ""}`).join("\n"));
    }
    if (novo.removidos_declarados_no_changelog?.length) {
      linhas.push(`\nRemoções que o próprio design system declara no changelog: ${novo.removidos_declarados_no_changelog.join("; ")}.`);
    }
  }
  if (!novo.vite_base_ok) linhas.push("\n**ERRO:** `vite.config.ts` perdeu a linha `base: '/DaniMoscatelli-DesignSystem/'`. Sem ela o endereço do site deixa de carregar.");
  const relatorio = linhas.join("\n") + "\n";
  console.log(relatorio);
  if (arqRelatorio) writeFileSync(arqRelatorio, relatorio);
  writeFileSync("versoes/diferencas-execucao.json", JSON.stringify({ removidos, adicionados }, null, 2) + "\n");
  saida({ removidos: String(totalRemovidos), adicionados: String(totalAdicionados), vite_base_ok: String(!!novo.vite_base_ok) });
}

function registrar(args) {
  const [versao, status, fonteSha, evento, arqDiferencas] = args;
  if (!versao || !status || !fonteSha) {
    console.error("Uso: registrar <versao> <publicada|retida> <fonte_sha> <evento> [diferencas.json]");
    process.exit(2);
  }
  const manifesto = lerManifesto();
  const agora = new Date().toISOString();
  const dif = arqDiferencas && existsSync(arqDiferencas) ? JSON.parse(readFileSync(arqDiferencas, "utf8")) : null;
  let entrada = manifesto.versoes.find((v) => v.versao === versao);
  if (!entrada) {
    entrada = { versao, fonte_sha: fonteSha, data: agora, status, inventario: `versoes/${versao}.json` };
    manifesto.versoes.push(entrada);
  }
  entrada.status = status;
  if (dif) {
    entrada.removidos = dif.removidos;
    entrada.adicionados = dif.adicionados;
  }
  if (status === "publicada") {
    manifesto.atual = versao;
    entrada.publicada_em = agora;
    manifesto.publicacoes.push({ data: agora, versao, evento: evento || "nova" });
  }
  gravarManifesto(manifesto);
  console.log(`Manifesto atualizado: ${versao} ${status}${status === "publicada" ? " (no ar)" : ""}.`);
}

const [comando, ...resto] = process.argv.slice(2);
if (comando === "planejar") planejar();
else if (comando === "comparar") comparar(resto);
else if (comando === "registrar") registrar(resto);
else {
  console.error("Comandos: planejar | comparar | registrar");
  process.exit(2);
}
