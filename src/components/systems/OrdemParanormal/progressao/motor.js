/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — MOTOR DE PROGRESSÃO AUTOMÁTICA
 *  ------------------------------------------------------------------------
 *  Lógica pura (zero React, zero Firestore). A ideia é simples e é a razão
 *  do módulo existir: TUDO que o livro determina sozinho o sistema aplica
 *  sozinho; o jogador só é chamado para o que o livro manda ELE escolher.
 *
 *  Três funções são o contrato:
 *
 *    derivar(ficha)              → números que nunca são digitados
 *                                  (PV/PE/SAN máximos, limite de PE por turno,
 *                                   círculo de ritual, DT, defesa, carga…)
 *    pendencias(ficha)           → escolhas que o livro deve ao personagem e
 *                                  ainda não foram feitas, já com as OPÇÕES
 *                                  válidas calculadas e as inválidas marcadas
 *                                  com o motivo.
 *    aplicar(ficha, resolucoes)  → devolve uma ficha nova com tudo aplicado.
 *
 *  Livro-razão: `ficha.progressao.marcos` guarda o que foi concedido em cada
 *  degrau de NEX. É ele que torna o motor IDEMPOTENTE (rodar duas vezes não
 *  duplica nada) e REVERSÍVEL (baixar o NEX desfaz só o que o motor deu,
 *  nunca o que o jogador escreveu à mão).
 * ════════════════════════════════════════════════════════════════════════ */

import {
  ATTR_KEYS, PERICIAS, CLASS_POWERS, CLASS_TRAILS, TRAIL_ABILITIES,
  cargaMaxima, cargaTeto, defaultTrainedSet,
} from "../rules";
import RITUAIS_OFICIAIS from "../../../../data/ordemParanormal/rituais-oficiais.json";
import {
  NEX_STEPS, NEX_MIN, NEX_MAX, CLASSES, MARCOS, PRE_REQUISITOS,
  BONUS_ORIGEM, CIRCULO_POR_NEX, ELEMENTOS_AFINIDADE, NEX_AFINIDADE,
} from "./tabelas";

export const VERSAO_PROGRESSAO = 1;

/* ── Utilidades de NEX ─────────────────────────────────────────────────── */

/** Nível interno (0 a 19). O 99% é o vigésimo degrau, não 19,8. */
export const nivelDeNex = (nex) => (Number(nex) >= NEX_MAX ? 19 : Math.max(0, (Number(nex) || NEX_MIN) - 5) / 5);

/** Normaliza qualquer número para o degrau de NEX válido mais próximo abaixo. */
export function normalizarNex(nex) {
  const v = Number(nex);
  if (!Number.isFinite(v)) return NEX_MIN;
  if (v >= NEX_MAX) return NEX_MAX;
  if (v <= NEX_MIN) return NEX_MIN;
  return [...NEX_STEPS].reverse().find((n) => v >= n) ?? NEX_MIN;
}

export const proximoNex = (nex) => NEX_STEPS.find((n) => n > normalizarNex(nex)) ?? null;
export const nexAnterior = (nex) => [...NEX_STEPS].reverse().find((n) => n < normalizarNex(nex)) ?? null;

/** Maior círculo de ritual que este NEX permite conjurar. */
export const circuloMaximo = (nex) =>
  CIRCULO_POR_NEX.find((c) => normalizarNex(nex) >= c.nex)?.circulo ?? 0;

/* ── Leitura defensiva da ficha ────────────────────────────────────────── */

const idDeClasse = (ficha) => ficha?.classe?.id || ficha?.classe || null;
const idDeOrigem = (ficha) => ficha?.origem?.id || null;
const idDeTrilha = (ficha) => ficha?.trilha?.id || ficha?.trilha || null;

const atributos = (ficha) => {
  const a = ficha?.attrs || {};
  return ATTR_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(a[k]) || 0 }), {});
};

/* Graus de treinamento, com as perícias que o livro concede de graça (as duas
 * da origem e as fixas da classe) como PISO. Sem esse piso o ocultista teria
 * de "escolher" Ocultismo e Vontade, que ele já tem por definição. */
const treinos = (ficha) => {
  const base = { ...(ficha?.skillTreino || {}) };
  for (const p of defaultTrainedSet(ficha?.origem, ficha?.classe)) {
    if (!((Number(base[p]) || 0) >= 5)) base[p] = 5;
  }
  return base;
};

const grauDe = (ficha, pericia) => Number(treinos(ficha)[pericia]) || 0;
const eTreinado = (ficha, pericia) => grauDe(ficha, pericia) >= 5;

/** Marcos que este personagem já alcançou, na ordem do livro. */
export function marcosAte(classeId, nex) {
  const lista = MARCOS[classeId] || [];
  const teto = normalizarNex(nex);
  return lista.filter((m) => m.nex <= teto);
}

export const chaveMarco = (m) => `${m.nex}:${m.ref}`;

const livroRazao = (ficha) => ficha?.progressao?.marcos || {};
const resolucaoDe = (ficha, chave) => livroRazao(ficha)[chave] || null;

/* ══════════════════════════════════════════════════════════════════════════
 *  1. DERIVAR — o que o jogador nunca deveria digitar
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Todos os números que saem da regra. Inclui os poderes de origem que
 * escalam com o NEX (Calejado, Cicatrizes Psicológicas, Dedicação), que hoje
 * o jogador precisaria somar de cabeça a cada missão.
 */
export function derivar(ficha) {
  const nex = normalizarNex(ficha?.nex);
  const nivel = nivelDeNex(nex);
  const classeId = idDeClasse(ficha);
  const c = CLASSES[classeId] || CLASSES.ocultista;
  const a = atributos(ficha);
  const bonus = BONUS_ORIGEM[idDeOrigem(ficha)] || null;

  const pvPorNivel = c.pv.porNex + (c.pv.vig ? a.VIG : 0);
  const pePorNivel = c.pe.porNex + (c.pe.pre ? a.PRE : 0);

  const pvOrigem = bonus?.pv ? bonus.pv(nex) : 0;
  const peOrigem = bonus?.pe ? bonus.pe(nex) : 0;
  const sanOrigem = bonus?.san ? bonus.san(nex) : 0;
  const limiteOrigem = bonus?.limitePe ? bonus.limitePe(nex) : 0;

  return {
    nex,
    nivel,
    classeId,
    classeNome: c.nome,
    /* máximos */
    pvMax: c.pv.base + (c.pv.vig ? a.VIG : 0) + nivel * pvPorNivel + pvOrigem,
    peMax: c.pe.base + (c.pe.pre ? a.PRE : 0) + nivel * pePorNivel + peOrigem,
    sanMax: c.san.base + nivel * c.san.porNex + sanOrigem,
    /* Tabela 1.2: 5% → 1 PE por turno … 99% → 20. */
    limitePeTurno: (nex >= NEX_MAX ? 20 : nex / 5) + limiteOrigem,
    /* rituais */
    circuloMax: circuloMaximo(nex),
    dtRituais: 10 + (nivel + 1) + a.PRE,
    /* combate / carga */
    defesaBase: 10 + a.AGI,
    cargaMax: cargaMaxima(a),
    cargaTeto: cargaTeto(a),
    proficiencias: c.proficiencias,
    /* transparência: de onde veio cada acréscimo fora da tabela da classe */
    bonusOrigem: bonus
      ? { poder: bonus.poder, nota: bonus.nota, pv: pvOrigem, pe: peOrigem, san: sanOrigem, limitePe: limiteOrigem }
      : null,
    ganhoPorNivel: { pv: pvPorNivel, pe: pePorNivel, san: c.san.porNex },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 *  2. PRÉ-REQUISITOS
 * ══════════════════════════════════════════════════════════════════════════ */

const rotuloAttr = { AGI: "Agilidade", FOR: "Força", INT: "Intelecto", PRE: "Presença", VIG: "Vigor" };

/**
 * Um poder está disponível? Devolve `{ ok, motivo }` — nunca só um booleano,
 * porque a interface precisa dizer POR QUE a opção está fechada.
 */
export function checarPreRequisito(poderId, ficha, jaEscolhidos = []) {
  const req = PRE_REQUISITOS[poderId] || {};

  /* "A menos que especificado o contrário, você não pode escolher um mesmo
   * poder mais de uma vez" (pg. 22) — vale para TODOS, inclusive os que não
   * têm nenhum outro pré-requisito. */
  if (!req.repetivel && jaEscolhidos.includes(poderId)) {
    return { ok: false, motivo: "Já escolhido — este poder não pode ser repetido." };
  }
  if (!PRE_REQUISITOS[poderId]) return { ok: true, motivo: "" };

  const a = atributos(ficha);
  const nex = normalizarNex(ficha?.nex);
  const faltas = [];

  for (const [k, min] of Object.entries(req.attrs || {})) {
    if ((a[k] ?? 0) < min) faltas.push(`${rotuloAttr[k] || k} ${min}`);
  }
  if (req.nex && nex < req.nex) faltas.push(`NEX ${req.nex}%`);
  for (const p of req.treinado || []) {
    if (!eTreinado(ficha, p)) faltas.push(`treinado em ${p}`);
  }
  if (req.treinadoUma && !req.treinadoUma.some((p) => eTreinado(ficha, p))) {
    faltas.push(`treinado em ${req.treinadoUma.join(" ou ")}`);
  }
  if (req.poder && !jaEscolhidos.includes(req.poder)) {
    const nome = (Object.values(CLASS_POWERS).flat().find((p) => p.id === req.poder) || {}).name || req.poder;
    faltas.push(`o poder ${nome}`);
  }
  return faltas.length ? { ok: false, motivo: `Falta: ${faltas.join(", ")}.` } : { ok: true, motivo: "" };
}

/** Ids de poderes de classe que a ficha já registrou pelo livro-razão. */
export function poderesEscolhidos(ficha) {
  return Object.values(livroRazao(ficha))
    .map((r) => r?.poder)
    .filter(Boolean);
}

/* ══════════════════════════════════════════════════════════════════════════
 *  3. PENDÊNCIAS — o que o livro deve ao personagem
 * ══════════════════════════════════════════════════════════════════════════ */

const opcoesDePoder = (classeId, ficha) => {
  const jaEscolhidos = poderesEscolhidos(ficha);
  return (CLASS_POWERS[classeId] || []).map((p) => {
    const { ok, motivo } = checarPreRequisito(p.id, ficha, jaEscolhidos);
    return { id: p.id, nome: p.name, desc: p.desc, custo: p.cost, disponivel: ok, motivo };
  });
};

const opcoesDeVersatilidade = (classeId, ficha) => {
  const minha = idDeTrilha(ficha);
  const deOutrasTrilhas = (CLASS_TRAILS[classeId] || [])
    .filter((t) => t.id !== minha)
    .map((t) => {
      const ab = (TRAIL_ABILITIES[t.id] || {})[10];
      if (!ab) return null;
      return {
        id: `trilha:${t.id}`, nome: `${ab.name} — trilha ${t.name}`, desc: ab.desc, custo: ab.cost,
        disponivel: true, motivo: "", trilhaAlheia: t.id,
      };
    })
    .filter(Boolean);
  return [...opcoesDePoder(classeId, ficha), ...deOutrasTrilhas];
};

const opcoesDeAtributo = (ficha) => {
  const a = atributos(ficha);
  return ATTR_KEYS.map((k) => ({
    id: k,
    nome: `${rotuloAttr[k]} (${k})`,
    desc: `${a[k]} → ${a[k] + 1}`,
    disponivel: a[k] < 5,
    motivo: a[k] >= 5 ? "Atributo já está no máximo (5)." : "",
  }));
};

/* Grau de treinamento: só sobe quem JÁ é treinado e ainda não é expert. */
const ROTULO_GRAU = { 0: "Destreinado", 5: "Treinado", 10: "Veterano", 15: "Expert" };

const opcoesDeGrau = (ficha) =>
  PERICIAS.map((p) => {
    const atual = grauDe(ficha, p.base);
    const podeSubir = atual >= 5 && atual < 15;
    return {
      id: p.base,
      nome: p.base,
      desc: podeSubir
        ? `${ROTULO_GRAU[atual]} (+${atual}) → ${ROTULO_GRAU[atual + 5]} (+${atual + 5})`
        : `${ROTULO_GRAU[atual] || "Destreinado"} (+${atual})`,
      disponivel: podeSubir,
      motivo: atual < 5 ? "Só perícias treinadas sobem de grau." : atual >= 15 ? "Já é expert." : "",
    };
  });

const opcoesDePericia = (ficha, permitidas = null) =>
  PERICIAS.filter((p) => !permitidas || permitidas.includes(p.base)).map((p) => ({
    id: p.base,
    nome: p.base,
    desc: `Atributo-base: ${p.attr}${p.onlyTrained ? " · só treinado" : ""}`,
    disponivel: grauDe(ficha, p.base) < 5,
    motivo: grauDe(ficha, p.base) >= 5 ? "Já treinada." : "",
  }));

const opcoesDeRitual = (ficha, circuloMax) => {
  const conhecidos = new Set((ficha?.rituais || []).map((r) => r?.id).filter(Boolean));
  return RITUAIS_OFICIAIS.filter((r) => Number(r.circulo) <= circuloMax).map((r) => ({
    id: r.id,
    nome: r.nome,
    desc: `${r.circulo}º círculo · ${r.elemento} · ${r.execucao} · ${r.alcance}`,
    disponivel: !conhecidos.has(r.id),
    motivo: conhecidos.has(r.id) ? "Já conhecido." : "",
    circulo: Number(r.circulo),
    elemento: r.elemento,
  }));
};

const NOMES_ELEMENTO = {
  conhecimento: "Conhecimento", energia: "Energia", morte: "Morte", sangue: "Sangue",
};

/**
 * Lista tudo que o personagem tem direito a escolher e ainda não escolheu.
 * Serve para os dois fluxos: subir de NEX (só o degrau novo) e auditar uma
 * ficha antiga preenchida à mão (todos os degraus de uma vez).
 *
 * @param {object} ficha
 * @param {{nexMin?:number}} [opts] só pendências de NEX acima deste valor.
 */
export function pendencias(ficha, opts = {}) {
  const classeId = idDeClasse(ficha);
  if (!classeId || !CLASSES[classeId]) return [];

  const nex = normalizarNex(ficha?.nex);
  const nexMin = Number.isFinite(opts.nexMin) ? opts.nexMin : 0;
  const a = atributos(ficha);
  const c = CLASSES[classeId];
  const lista = [];

  const push = (p) => { if (p.nex > nexMin && !resolucaoDe(ficha, p.id)) lista.push(p); };

  /* ── NEX 5%: perícias da classe ── */
  c.periciasEscolhaUma.forEach((grupo, i) => {
    push({
      id: `5:pericia_grupo_${i}`, nex: 5, tipo: "pericia", ref: `pericia_grupo_${i}`,
      titulo: `Perícia de classe — ${grupo.join(" ou ")}`,
      descricao: `${c.nome} é treinado em uma destas duas. Escolha qual.`,
      quantidade: 1, opcoes: opcoesDePericia(ficha, grupo),
    });
  });
  const livres = c.periciasLivres(a.INT);
  const fixoDaConta = { combatente: 1, especialista: 7, ocultista: 3 }[classeId];
  push({
    id: "5:pericias_livres", nex: 5, tipo: "pericia", ref: "pericias_livres",
    titulo: "Perícias treinadas da classe",
    descricao: `${c.nome} treina ${livres} perícias à sua escolha (${fixoDaConta} + Intelecto ${a.INT}). As da origem já vêm marcadas.`,
    quantidade: livres, opcoes: opcoesDePericia(ficha),
  });

  /* ── Marcos da classe ── */
  for (const m of marcosAte(classeId, nex)) {
    const id = chaveMarco(m);
    switch (m.tipo) {
      case "trilha":
        push({
          id, nex: m.nex, tipo: "trilha", ref: m.ref,
          titulo: "Escolha sua trilha",
          descricao: "A trilha define suas quatro habilidades exclusivas (NEX 10%, 40%, 65% e 99%). A escolha é definitiva.",
          quantidade: 1,
          opcoes: (CLASS_TRAILS[classeId] || []).map((t) => ({
            id: t.id, nome: t.name,
            desc: ((TRAIL_ABILITIES[t.id] || {})[10] || {}).desc || "",
            disponivel: true, motivo: "",
          })),
        });
        break;
      case "poder_classe":
        push({
          id, nex: m.nex, tipo: "poder_classe", ref: m.ref,
          titulo: m.rotulo,
          descricao: "Poderes com pré-requisito não cumprido ficam bloqueados, com o motivo à mostra.",
          quantidade: 1, opcoes: opcoesDePoder(classeId, ficha),
        });
        break;
      case "versatilidade":
        push({
          id, nex: m.nex, tipo: "versatilidade", ref: m.ref,
          titulo: "Versatilidade",
          descricao: "No NEX 50% você recebe um poder da sua classe OU o primeiro poder de uma trilha que não é a sua.",
          quantidade: 1, opcoes: opcoesDeVersatilidade(classeId, ficha),
        });
        break;
      case "aumento_atributo":
        push({
          id, nex: m.nex, tipo: "aumento_atributo", ref: m.ref,
          titulo: "Aumento de atributo",
          descricao: "Some +1 em um atributo. O teto por esta via é 5.",
          quantidade: 1, opcoes: opcoesDeAtributo(ficha),
        });
        break;
      case "grau_treinamento": {
        const qtd = c.grauTreinamento(a.INT);
        push({
          id, nex: m.nex, tipo: "grau_treinamento", ref: m.ref,
          titulo: "Grau de treinamento",
          descricao: `Suba o grau de ${qtd} perícias treinadas (${qtd - a.INT} + Intelecto ${a.INT} — a conta muda por classe).`,
          quantidade: qtd, opcoes: opcoesDeGrau(ficha),
        });
        break;
      }
      default:
        break;
    }
  }

  /* ── Afinidade elemental (NEX 50%, qualquer classe) ── */
  if (nex >= NEX_AFINIDADE && !ficha?.elementoAfinidade) {
    push({
      id: `${NEX_AFINIDADE}:afinidade`, nex: NEX_AFINIDADE, tipo: "afinidade", ref: "afinidade",
      titulo: "Afinidade com um elemento",
      descricao: "No NEX 50% existe tanto do Outro Lado em você quanto da Realidade, e a ligação com uma entidade acontece. A escolha é definitiva.",
      quantidade: 1,
      opcoes: ELEMENTOS_AFINIDADE.map((e) => ({
        id: e, nome: NOMES_ELEMENTO[e], desc: "", disponivel: true, motivo: "",
      })),
    });
  }

  /* ── Rituais do ocultista ── */
  if (classeId === "ocultista") {
    push({
      id: "5:rituais_iniciais", nex: 5, tipo: "ritual", ref: "rituais_iniciais",
      titulo: "Rituais iniciais",
      descricao: "O ocultista começa conhecendo três rituais de 1º círculo.",
      quantidade: 3, opcoes: opcoesDeRitual(ficha, 1),
    });
    for (const passo of NEX_STEPS) {
      if (passo <= 5 || passo > nex) continue;
      push({
        id: `${passo}:ritual`, nex: passo, tipo: "ritual", ref: "ritual",
        titulo: `Ritual aprendido no NEX ${passo}%`,
        descricao: "A cada novo nível de exposição o ocultista aprende um ritual de qualquer círculo que já consiga conjurar.",
        quantidade: 1, opcoes: opcoesDeRitual(ficha, circuloMaximo(passo)),
      });
    }
  }

  return lista.sort((x, y) => x.nex - y.nex);
}

/* ══════════════════════════════════════════════════════════════════════════
 *  4. CONCESSÕES AUTOMÁTICAS — nada a escolher, o motor aplica
 * ══════════════════════════════════════════════════════════════════════════ */

const habOrigem = (marcoId, ref) => ({ marco: marcoId, ref, motor: VERSAO_PROGRESSAO });
const ehDoMotor = (h) => !!h?.origem?.motor;

const montaHabilidade = (marcoId, ref, nome, desc, custo) => ({
  id: `prog_${marcoId}`,
  nome,
  descricao: custo && custo !== "—" ? `<b>Custo:</b> ${custo}<br><br>${desc}` : desc,
  dados: "",
  imagem_url: "",
  origem: habOrigem(marcoId, ref),
});

/**
 * Habilidades que o motor DEVE ter concedido nesta ficha, dado o NEX, a
 * classe, a trilha e as escolhas já registradas. É a lista-verdade: o
 * sincronizador adiciona o que falta e remove o que sobra — e só mexe no que
 * tem carimbo do motor, nunca no que o jogador escreveu.
 */
export function habilidadesEsperadas(ficha) {
  const classeId = idDeClasse(ficha);
  if (!classeId || !CLASSES[classeId]) return [];
  const nex = normalizarNex(ficha?.nex);
  const trilhaId = idDeTrilha(ficha);
  const razao = livroRazao(ficha);
  const esperadas = [];

  /* uma versão aposentada por outra já alcançada não entra */
  const marcos = marcosAte(classeId, nex);
  const substituidos = new Set(marcos.map((m) => m.substitui).filter(Boolean));

  for (const m of marcos) {
    const id = chaveMarco(m);
    if (m.tipo === "habilidade") {
      if (substituidos.has(m.ref)) continue;
      esperadas.push(montaHabilidade(id, m.ref, m.nome, m.desc, m.custo));
      continue;
    }
    if ((m.tipo === "trilha" || m.tipo === "habilidade_trilha") && trilhaId) {
      const ab = (TRAIL_ABILITIES[trilhaId] || {})[m.nex];
      if (ab) esperadas.push(montaHabilidade(id, m.ref, ab.name, ab.desc, ab.cost));
      continue;
    }
    if (m.tipo === "poder_classe" || m.tipo === "versatilidade") {
      const escolha = razao[id];
      if (!escolha?.poder) continue;
      if (String(escolha.poder).startsWith("trilha:")) {
        const alheia = String(escolha.poder).slice(7);
        const ab = (TRAIL_ABILITIES[alheia] || {})[10];
        if (ab) esperadas.push(montaHabilidade(id, m.ref, ab.name, ab.desc, ab.cost));
        continue;
      }
      const p = (CLASS_POWERS[classeId] || []).find((x) => x.id === escolha.poder);
      if (p) esperadas.push(montaHabilidade(id, m.ref, p.name, p.desc, p.cost));
    }
  }

  /* poder da origem: texto fixo, entra uma vez só */
  const origem = ficha?.origem;
  const textoOrigem = origem?.power || origem?.poder?.desc || "";
  if (textoOrigem) {
    const nome = origem.poder?.name || String(textoOrigem).split(".")[0] || "Poder de origem";
    esperadas.push(montaHabilidade("origem:poder", "origem_poder", nome, textoOrigem, "—"));
  }

  return esperadas;
}

/**
 * Alinha a lista de habilidades da ficha com `habilidadesEsperadas`.
 * Habilidades sem carimbo do motor (criadas ou editadas pelo jogador) passam
 * intactas — inclusive as que ele adicionou manualmente com o mesmo nome.
 */
export function sincronizarHabilidades(ficha) {
  const atuais = Array.isArray(ficha?.habilidades) ? ficha.habilidades : [];
  const esperadas = habilidadesEsperadas(ficha);
  const porMarco = new Map(esperadas.map((h) => [h.origem.marco, h]));

  let manuais = atuais.filter((h) => !ehDoMotor(h));
  const doMotor = atuais.filter(ehDoMotor);

  /* mantém a instância existente (preserva dados/imagem que o jogador pôs)
   * mas atualiza nome e texto, que são a regra e não podem divergir do livro */
  const mantidas = doMotor
    .filter((h) => porMarco.has(h.origem.marco))
    .map((h) => {
      const alvo = porMarco.get(h.origem.marco);
      porMarco.delete(h.origem.marco);
      return { ...h, nome: alvo.nome, descricao: alvo.descricao, origem: alvo.origem };
    });

  /* ADOÇÃO — fichas antigas foram preenchidas à mão e já têm, por exemplo,
   * "Ataque Especial" digitado pelo jogador. Sem isto o motor concederia uma
   * segunda cópia. Casando pelo nome, a entrada existente é ADOTADA (ganha o
   * carimbo do motor) em vez de duplicada. */
  const adotadas = [];
  for (const [marco, alvo] of [...porMarco.entries()]) {
    const i = manuais.findIndex((h) => String(h?.nome || "").trim().toLowerCase() === alvo.nome.trim().toLowerCase());
    if (i < 0) continue;
    const antiga = manuais[i];
    manuais = manuais.filter((_, idx) => idx !== i);
    porMarco.delete(marco);
    adotadas.push({ ...antiga, nome: alvo.nome, descricao: alvo.descricao, origem: alvo.origem });
  }

  return [...manuais, ...mantidas, ...adotadas, ...porMarco.values()];
}

/* ══════════════════════════════════════════════════════════════════════════
 *  5. APLICAR
 * ══════════════════════════════════════════════════════════════════════════ */

const comoLista = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);

/** Descobre o tipo de uma pendência pelo id, sem precisar recalcular a lista. */
export function tipoDaPendencia(id, classeId) {
  const [nexStr, ref = ""] = String(id).split(":");
  if (ref.startsWith("pericia_grupo") || ref === "pericias_livres") return "pericia";
  if (ref === "rituais_iniciais" || ref === "ritual") return "ritual";
  if (ref === "afinidade") return "afinidade";
  if (ref.startsWith("atributo")) return "aumento_atributo";
  if (ref.startsWith("grau")) return "grau_treinamento";
  if (ref.startsWith("versatilidade")) return "versatilidade";
  if (ref.startsWith("poder")) return "poder_classe";
  if (ref.startsWith("trilha")) {
    const m = (MARCOS[classeId] || []).find((x) => chaveMarco(x) === `${nexStr}:${ref}`);
    return m?.tipo === "habilidade_trilha" ? "habilidade_trilha" : "trilha";
  }
  return "desconhecido";
}

/**
 * Grava na ficha os máximos derivados e apara os valores atuais.
 * Chamado no fim de todo `aplicar` — é o que dispensa o jogador de recalcular
 * PV/PE/SAN a cada avanço.
 */
export function aplicarDerivados(ficha) {
  const d = derivar(ficha);
  const apara = (atual, max) => {
    const v = Number(atual);
    return Number.isFinite(v) ? Math.min(v, max) : max;
  };
  return {
    ...ficha,
    pvMax: d.pvMax,
    peMax: d.peMax,
    sanMax: d.sanMax,
    pv: apara(ficha.pv, d.pvMax),
    pe: apara(ficha.pe, d.peMax),
    san: apara(ficha.san, d.sanMax),
    dtRituais: d.dtRituais + (Number(ficha.dtRituaisBonus) || 0),
  };
}

/**
 * Aplica um conjunto de resoluções e devolve uma ficha nova.
 *
 * @param {object} ficha
 * @param {Record<string, any>} resolucoes  id da pendência → escolha
 *        pericia/grau      → string | string[]
 *        poder/versatilid. → id do poder (ou "trilha:<id>")
 *        atributo          → "FOR"
 *        trilha            → id da trilha
 *        afinidade         → id do elemento
 *        ritual            → id do ritual | id[]
 * @param {{nex?:number}} [opts] sobe o NEX junto (usar no assistente).
 */
export function aplicar(ficha, resolucoes = {}, opts = {}) {
  const classeId = idDeClasse(ficha);
  const nexAlvo = opts.nex !== undefined ? normalizarNex(opts.nex) : normalizarNex(ficha?.nex);

  const out = {
    ...ficha,
    nex: nexAlvo,
    attrs: { ...atributos(ficha) },
    skillTreino: { ...treinos(ficha) },
    rituais: Array.isArray(ficha?.rituais) ? [...ficha.rituais] : [],
    progressao: {
      v: VERSAO_PROGRESSAO,
      marcos: { ...livroRazao(ficha) },
    },
  };

  const registrar = (id, dados) => {
    out.progressao.marcos[id] = { ...(out.progressao.marcos[id] || {}), ...dados };
  };

  for (const [id, escolha] of Object.entries(resolucoes)) {
    if (escolha === undefined || escolha === null || escolha === "") continue;

    switch (tipoDaPendencia(id, classeId)) {
      case "pericia":
        for (const p of comoLista(escolha)) {
          out.skillTreino[p] = Math.max(Number(out.skillTreino[p]) || 0, 5);
        }
        registrar(id, { pericias: comoLista(escolha) });
        break;

      case "grau_treinamento": {
        const aplicadas = [];
        for (const p of comoLista(escolha)) {
          const antes = Number(out.skillTreino[p]) || 0;
          if (antes < 5 || antes >= 15) continue;
          out.skillTreino[p] = antes + 5;
          aplicadas.push({ pericia: p, de: antes, para: antes + 5 });
        }
        registrar(id, { graus: aplicadas });
        break;
      }

      case "aumento_atributo": {
        const k = String(escolha);
        if (ATTR_KEYS.includes(k) && out.attrs[k] < 5) {
          out.attrs[k] += 1;
          registrar(id, { atributo: k });
        }
        break;
      }

      case "trilha": {
        const t = (CLASS_TRAILS[classeId] || []).find((x) => x.id === escolha);
        if (t) { out.trilha = { id: t.id, name: t.name }; registrar(id, { trilha: t.id }); }
        break;
      }

      case "poder_classe":
      case "versatilidade":
        registrar(id, { poder: String(escolha) });
        break;

      case "afinidade":
        if (ELEMENTOS_AFINIDADE.includes(String(escolha))) {
          out.elementoAfinidade = String(escolha);
          out.elementoEscolhidoEm = out.elementoEscolhidoEm || Date.now();
          registrar(id, { elemento: String(escolha) });
        }
        break;

      case "ritual": {
        const conhecidos = new Set(out.rituais.map((r) => r?.id).filter(Boolean));
        const novos = [];
        for (const rid of comoLista(escolha)) {
          if (conhecidos.has(rid)) continue;
          const r = RITUAIS_OFICIAIS.find((x) => x.id === rid);
          if (!r) continue;
          out.rituais.push({ ...r, origem: habOrigem(id, "ritual") });
          conhecidos.add(rid);
          novos.push(rid);
        }
        registrar(id, { rituais: novos });
        break;
      }

      default:
        break;
    }
  }

  out.habilidades = sincronizarHabilidades(out);
  return aplicarDerivados(out);
}

/* ══════════════════════════════════════════════════════════════════════════
 *  6. PLANO DE AVANÇO — o que muda ao subir um degrau
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compara a ficha atual com ela mesma no NEX alvo e devolve o que é
 * automático (para exibir) e o que exige escolha (para perguntar).
 */
export function planoDeAvanco(ficha, nexAlvo) {
  const de = normalizarNex(ficha?.nex);
  const para = normalizarNex(nexAlvo);
  const antes = derivar(ficha);
  const depois = derivar({ ...ficha, nex: para });
  const classeId = idDeClasse(ficha);

  const delta = (rotulo, a, b, sufixo = "") =>
    a === b ? null : { rotulo, de: a, para: b, ganho: b - a, sufixo };

  const automaticos = [
    delta("Pontos de Vida", antes.pvMax, depois.pvMax),
    delta("Pontos de Esforço", antes.peMax, depois.peMax),
    delta("Sanidade", antes.sanMax, depois.sanMax),
    delta("Limite de PE por turno", antes.limitePeTurno, depois.limitePeTurno),
    delta("DT dos seus rituais", antes.dtRituais, depois.dtRituais),
    delta("Círculo máximo de ritual", antes.circuloMax, depois.circuloMax, "º"),
  ].filter(Boolean);

  /* habilidades de texto fixo e poderes de trilha que chegam sozinhos */
  const trilhaId = idDeTrilha(ficha);
  const habilidadesAutomaticas = (MARCOS[classeId] || [])
    .filter((m) => m.nex > de && m.nex <= para)
    .map((m) => {
      if (m.tipo === "habilidade") {
        return { nex: m.nex, nome: m.nome, desc: m.desc, custo: m.custo, substitui: m.substitui };
      }
      if (m.tipo === "habilidade_trilha" && trilhaId) {
        const ab = (TRAIL_ABILITIES[trilhaId] || {})[m.nex];
        return ab ? { nex: m.nex, nome: ab.name, desc: ab.desc, custo: ab.cost } : null;
      }
      if (m.tipo === "circulo_ritual") {
        return { nex: m.nex, nome: m.rotulo, desc: `Você passa a conjurar rituais de ${m.circulo}º círculo.`, custo: "—" };
      }
      return null;
    })
    .filter(Boolean);

  return {
    de,
    para,
    subiu: para > de,
    automaticos,
    habilidadesAutomaticas,
    /* as escolhas do intervalo — a ficha ainda está no NEX antigo, então
     * consultamos as pendências de uma cópia já no NEX alvo */
    escolhas: pendencias({ ...ficha, nex: para }, { nexMin: de }),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 *  7. REVERTER — baixar o NEX sem destruir o que é do jogador
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Desfaz o que o motor concedeu acima de `nexAlvo`: devolve os pontos de
 * atributo, baixa os graus de treinamento, tira os rituais aprendidos e as
 * habilidades concedidas. Perícias e habilidades que o jogador criou à mão
 * continuam onde estavam.
 */
export function reverterPara(ficha, nexAlvo) {
  const alvo = normalizarNex(nexAlvo);
  const razao = livroRazao(ficha);

  const attrs = { ...atributos(ficha) };
  const skillTreino = { ...treinos(ficha) };
  let rituais = Array.isArray(ficha?.rituais) ? [...ficha.rituais] : [];
  const marcos = {};
  let trilha = ficha?.trilha ?? null;
  let elementoAfinidade = ficha?.elementoAfinidade ?? null;

  for (const [id, res] of Object.entries(razao)) {
    const nexDoMarco = Number(String(id).split(":")[0]) || 0;
    if (nexDoMarco <= alvo) { marcos[id] = res; continue; }

    if (res?.atributo && attrs[res.atributo] > 0) attrs[res.atributo] -= 1;
    for (const g of res?.graus || []) {
      if ((Number(skillTreino[g.pericia]) || 0) === g.para) skillTreino[g.pericia] = g.de;
    }
    for (const p of res?.pericias || []) {
      if ((Number(skillTreino[p]) || 0) === 5) delete skillTreino[p];
    }
    if (res?.rituais?.length) {
      const remover = new Set(res.rituais);
      rituais = rituais.filter((r) => !remover.has(r?.id));
    }
    if (res?.trilha) trilha = null;
    if (res?.elemento) elementoAfinidade = null;
  }

  const out = {
    ...ficha,
    nex: alvo,
    attrs,
    skillTreino,
    rituais,
    trilha,
    elementoAfinidade,
    progressao: { v: VERSAO_PROGRESSAO, marcos },
  };
  out.habilidades = sincronizarHabilidades(out);
  return aplicarDerivados(out);
}

/* ══════════════════════════════════════════════════════════════════════════
 *  8. DIAGNÓSTICO — para a aba de progressão
 * ══════════════════════════════════════════════════════════════════════════ */

/** Linha do tempo de todos os degraus, com o que cada um deu e o que ficou devendo. */
export function linhaDoTempo(ficha) {
  const classeId = idDeClasse(ficha);
  const nex = normalizarNex(ficha?.nex);
  const abertas = new Set(pendencias(ficha).map((p) => p.id));
  const razao = livroRazao(ficha);
  const exigeEscolha = ["trilha", "poder_classe", "versatilidade", "aumento_atributo", "grau_treinamento"];

  return NEX_STEPS.map((passo) => {
    const itens = (MARCOS[classeId] || [])
      .filter((m) => m.nex === passo)
      .map((m) => {
        const id = chaveMarco(m);
        return {
          id,
          rotulo: m.rotulo || m.nome,
          tipo: m.tipo,
          exigeEscolha: exigeEscolha.includes(m.tipo),
          pendente: abertas.has(id),
          resolucao: razao[id] || null,
        };
      });

    if (classeId === "ocultista" && passo > 5) {
      itens.push({
        id: `${passo}:ritual`, rotulo: "Ritual aprendido", tipo: "ritual",
        exigeEscolha: true, pendente: abertas.has(`${passo}:ritual`), resolucao: razao[`${passo}:ritual`] || null,
      });
    }
    if (passo === NEX_AFINIDADE) {
      itens.push({
        id: `${passo}:afinidade`, rotulo: "Afinidade elemental", tipo: "afinidade",
        exigeEscolha: true, pendente: abertas.has(`${passo}:afinidade`),
        resolucao: ficha?.elementoAfinidade ? { elemento: ficha.elementoAfinidade } : null,
      });
    }
    return { nex: passo, alcancado: nex >= passo, atual: nex === passo, itens };
  });
}
