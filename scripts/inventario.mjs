// Inventário de uma versão do DM Design System.
// Uso: node scripts/inventario.mjs <pasta-da-fonte> <arquivo-de-saida.json>
// Lê o código enviado pelo Figma Make e lista o que existe: grupos e itens do menu,
// seções (arquivos *Showcase.tsx), âncoras <section id>, componentes de ui/, tokens do theme.css
// e as remoções declaradas no changelog do próprio design system.
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const [fonte, saida] = process.argv.slice(2);
if (!fonte || !saida) {
  console.error("Uso: node scripts/inventario.mjs <pasta-da-fonte> <saida.json>");
  process.exit(2);
}

const ler = (rel) => {
  const p = join(fonte, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};
const listar = (rel, filtro) => {
  const p = join(fonte, rel);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter(filtro).sort();
};
const unicos = (a) => [...new Set(a)].sort();

// Menu (App.tsx): grupos têm `icon:`; itens têm `sectionId:`.
const app = ler("src/app/App.tsx");
// A identidade é o id (os rótulos mudam com a tradução); os rótulos ficam em `rotulos`, só para leitura.
const rotulos = {};
const menuGrupos = unicos(
  [...app.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*icon:\s*\w+/g)].map((m) => {
    rotulos[m[1]] = m[2];
    return m[1];
  })
);
const menuItens = unicos(
  [...app.matchAll(/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*sectionId:\s*"([^"]+)"/g)].map((m) => {
    rotulos[`${m[3]}/${m[1]}`] = m[2];
    return `${m[3]}/${m[1]}`;
  })
);

// Seções: um arquivo *Showcase.tsx por seção.
const secoes = listar("src/app/components/showcase", (f) => /Showcase\.tsx$/.test(f)).map((f) =>
  f.replace(/Showcase\.tsx$/, "")
);

// Âncoras <section id="..."> dentro das seções.
const ancoras = unicos(
  listar("src/app/components/showcase", (f) => f.endsWith(".tsx")).flatMap((f) =>
    [...ler(`src/app/components/showcase/${f}`).matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1])
  )
);

// Componentes de interface (shadcn/ui + próprios).
const componentes = listar("src/app/components/ui", (f) => f.endsWith(".tsx")).map((f) => f.replace(/\.tsx$/, ""));

// Tokens: variáveis CSS definidas no theme.css.
const theme = ler("src/styles/theme.css");
const tokens = unicos([...theme.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim).map((m) => m[1])]);

// Remoções declaradas pelo próprio design system (changelog.ts), quando existir.
const changelog = ler("src/app/components/showcase/shared/changelog.ts");
const removidosDeclarados = [
  ...changelog.matchAll(/kind:\s*"Removed",\s*title:\s*\{[^}]*?pt:\s*"([^"]+)"/g),
].map((m) => m[1]);

// Proteção conhecida: o GitHub Pages depende desta linha do vite.config.ts (VITE_BASE, padrão do DM Design System).
const VITE_BASE = process.env.VITE_BASE || "/DaniMoscatelli-DesignSystem/";
const vite = ler("vite.config.ts");
const viteBaseOk = vite.includes(`base: '${VITE_BASE}'`) || vite.includes(`base: "${VITE_BASE}"`);

const inventario = {
  gerado_em: new Date().toISOString(),
  vite_base_ok: viteBaseOk,
  totais: {
    menu_grupos: menuGrupos.length,
    menu_itens: menuItens.length,
    secoes: secoes.length,
    ancoras: ancoras.length,
    componentes: componentes.length,
    tokens: tokens.length,
  },
  menu_grupos: menuGrupos,
  menu_itens: menuItens,
  secoes,
  ancoras,
  componentes,
  tokens,
  rotulos,
  removidos_declarados_no_changelog: removidosDeclarados,
};

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(inventario, null, 2) + "\n");
console.log(`Inventário gravado em ${saida}:`, JSON.stringify(inventario.totais));
if (!viteBaseOk) console.log(`ATENÇÃO: vite.config.ts sem base '${VITE_BASE}'.`);
