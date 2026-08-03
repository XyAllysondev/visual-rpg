/* ════════════════════════════════════════════════════════════════════
 *  PERSISTÊNCIA DA NÉVOA  (spec 0028 · F3 · AC-5, AC-10)
 *  --------------------------------------------------------------------
 *  O dono da MÁSCARA, e só dela — o MOLDE (mapa, nós, trilhas, ilustração)
 *  é do `worldMapStore.js`.
 *
 *  ── ONDE ESTE ARQUIVO ACABA (spec 0030 · onda 1.5) ──────────────────
 *  O I/O saiu daqui: quem fala com o Firestore é
 *  `infrastructure/firestore/fogRepo.js` (ADR-0010). Aqui ficou o que só
 *  este módulo sabe — o FORMATO da névoa (serializar/desserializar), a
 *  RECUSA por tamanho e a POLÍTICA DE UI (debounce, estados do React).
 *  A divisão não é cosmética: o repo trata `data` como string opaca, então
 *  existe UM lugar que entende bitmap de névoa, e é `model/fogMask.js`.
 *
 *  ── POR QUE UM DOCUMENTO SÓ PARA ELA ────────────────────────────────
 *  `users/{uid}/worldmaps/{mapId}/media/fog`
 *
 *  Fora do doc raiz do molde pelo mesmo motivo da ilustração de fundo: o
 *  raiz é o que `useWorldMaps` assina para montar a grade do Ateliê. Se a
 *  máscara morasse nele, a LISTA de mapas baixaria a névoa inteira de cada
 *  mapa a cada snapshot — dezenas de KB por card, por atualização, para
 *  desenhar um card que nem mostra névoa.
 *
 *  Fora das subcoleções `nodes`/`edges` porque a névoa não é item de grafo:
 *  é um blob único que se reescreve inteiro. Documento próprio, id fixo
 *  (`fog`), um por molde.
 *
 *  Quando a F4 levar o mapa para a mesa, a névoa daquele GRUPO nasce noutro
 *  caminho (`campaigns/{cid}/...`), porque o progresso é por mesa (design
 *  §1). O formato do payload é o mesmo — é por isso que ele mora em
 *  `model/fogMask.js`, longe daqui.
 *
 *  ── DEBOUNCE, E POR QUE ELE NÃO É OPCIONAL ──────────────────────────
 *  Uma pincelada do mestre dispara dezenas de `revelarAoLongoDe` por
 *  segundo, e a viagem da F4 vai disparar um por passo. Gravar a cada um
 *  seria uma escrita de ~30 KB por quadro. `useSalvarFog` acumula e grava
 *  uma vez, depois de `ESPERA_DA_NEVOA` parado — e faz o flush final ao
 *  desmontar, para que fechar o editor no meio de um traço não perca o
 *  traço.
 *
 *  ── RECUSA EXPLÍCITA ────────────────────────────────────────────────
 *  Documento do Firestore tem 1 MiB. Antes de gravar, `salvarFog` mede o
 *  payload (`cabeNoDocumento`) e RECUSA em português se estourar, em vez de
 *  deixar o SDK falhar com um erro que ninguém entende — e sem gravar pela
 *  metade. Mesma postura de `uploadBackground` no `worldMapStore`.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import * as fogRepo from "../../infrastructure/firestore/fogRepo";
import {
  cabeNoDocumento, desserializar, serializar, TETO_DA_MASCARA_BYTES,
} from "./model/fogMask";

/* ── Caminho ─────────────────────────────────────────────────────────── */

/* Onda 1.5 (spec 0030): quem monta o caminho agora é `infrastructure/firestore/paths.js`
   (`atelieMediaDoc`), e quem fala com o SDK é o `fogRepo`. Estas constantes sobreviveram
   porque são o VOCABULÁRIO público do módulo — `FOG_REF` é gravado no molde e o contrato
   de `fogStore.test.js` confere o caminho por elas. Elas descrevem o caminho; não o
   constroem mais. Se `paths.js` mudar a coleção, é o teste do caminho que acusa. */
export const USERS = "users";
export const WORLDMAPS = "worldmaps";
export const MEDIA = "media";

/** Id fixo: um molde tem UMA névoa. Trocar substitui, não acumula. */
export const FOG_DOC_ID = "fog";

/** Valor de referência gravado no molde quando alguém precisar apontar para cá. */
export const FOG_REF = `${MEDIA}/${FOG_DOC_ID}`;

/** Quanto tempo o mestre precisa ficar parado antes de a névoa ir ao banco. */
export const ESPERA_DA_NEVOA = 900;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

function exigir(valor, mensagem) {
  const t = texto(valor);
  if (!t) throw new Error(mensagem);
  return t;
}

/* ── Leitura ─────────────────────────────────────────────────────────── */

/**
 * A névoa gravada, uma vez. `null` quando o molde nunca teve névoa.
 *
 * Máscara corrompida NÃO derruba a tela: o erro é registrado no console e a
 * leitura devolve `null`, que a UI trata como "ainda não há névoa" e oferece
 * criar uma nova. Perder uma névoa quebrada é ruim; travar o editor porque um
 * campo veio torto é pior.
 *
 * @param {string} uid dono do molde.
 * @param {string} mapId id do molde.
 * @returns {Promise<object|null>} máscara de `model/fogMask.js`.
 */
export async function lerFog(uid, mapId) {
  const dono = exigir(uid, "É preciso estar autenticado para abrir a névoa do mapa.");
  const id = exigir(mapId, "Informe de qual mapa-múndi é a névoa.");
  const registro = await fogRepo.get(dono, id);
  if (!registro) return null;
  return decodificar(registro);
}

/** Registro → máscara, tolerando payload quebrado. */
function decodificar(dados) {
  const bruto = dados && typeof dados.data === "string" ? dados.data : "";
  if (!bruto) return null;
  try {
    return desserializar(bruto);
  } catch (err) {
    console.error("[fogStore] a névoa gravada não pôde ser lida e foi ignorada:", err);
    return null;
  }
}

/* ── Escrita ─────────────────────────────────────────────────────────── */

/**
 * Grava a máscara, comprimida, no documento próprio da névoa.
 *
 * Recusa antes de tentar quando o payload não cabe (ver o cabeçalho). O
 * documento guarda também as dimensões e o tamanho em bytes em campos soltos:
 * são baratos, não exigem decodificar nada para responder "que mapa é este e
 * quanto ele está pesando", e é isso que a UI mostra ao mestre.
 *
 * @param {string} uid dono do molde.
 * @param {string} mapId id do molde.
 * @param {object} mascara máscara de `model/fogMask.js`.
 * @param {{teto?:number}} [opcoes] teto de bytes. Existe para a F4 poder apertar
 *   o orçamento no documento da campanha, que carrega mais coisa que este.
 * @returns {Promise<{bytes:number}>}
 * @throws {Error} em PT-BR quando falta dado ou o payload estoura o teto.
 */
export async function salvarFog(uid, mapId, mascara, opcoes = {}) {
  const dono = exigir(uid, "É preciso estar autenticado para gravar a névoa.");
  const id = exigir(mapId, "Informe de qual mapa-múndi é a névoa.");
  if (!mascara || !mascara.bits) throw new Error("Não há névoa para gravar neste mapa.");

  const teto = Number.isFinite(opcoes.teto) && opcoes.teto > 0 ? opcoes.teto : TETO_DA_MASCARA_BYTES;
  const cabe = cabeNoDocumento(mascara, teto);
  if (!cabe.ok) throw new Error(cabe.motivo);

  /* A serialização acontece AQUI: o `fogRepo` recebe `data` já pronto e o grava sem
     tocar. O `updatedAt` é carimbado lá dentro, porque `serverTimestamp()` é primitiva
     do SDK e não atravessa a fronteira (ADR-0010). */
  const data = serializar(mascara);
  await fogRepo.save(dono, id, {
    data,
    largura: mascara.largura,
    altura: mascara.altura,
    escala: mascara.escala,
    bytes: data.length,
  });
  return { bytes: data.length };
}

/**
 * Apaga a névoa do molde. O mapa continua existindo — some só a máscara, e o
 * próximo carregamento nasce com tudo coberto.
 */
export async function apagarFog(uid, mapId) {
  const dono = exigir(uid, "É preciso estar autenticado para apagar a névoa.");
  const id = exigir(mapId, "Informe de qual mapa-múndi é a névoa.");
  await fogRepo.remove(dono, id);
}

/* ── Hooks ───────────────────────────────────────────────────────────── */

/**
 * A névoa do molde em tempo real.
 *
 * Sem uid ou sem mapId não assina nada e devolve `null` — não é erro, é "não
 * há molde aberto". É o que permite o MAPA PADRÃO (que não existe no
 * Firestore, AC-13) chamar o hook sem condicional.
 *
 * `mascara` é `null` enquanto ninguém gravou névoa neste mapa. Quem decide
 * criar a primeira máscara é a tela — ela é a única que sabe o tamanho do
 * mundo.
 *
 * @param {string} uid
 * @param {string} mapId
 * @returns {{mascara:object|null, bytes:number, loading:boolean, error:Error|null}}
 */
export function useFog(uid, mapId) {
  const [estado, setEstado] = useState({ mascara: null, bytes: 0, loading: false, error: null });

  useEffect(() => {
    if (!uid || !mapId) {
      setEstado({ mascara: null, bytes: 0, loading: false, error: null });
      return undefined;
    }
    setEstado({ mascara: null, bytes: 0, loading: true, error: null });

    const unsub = fogRepo.watch(
      uid,
      mapId,
      (dados) => {
        setEstado({
          mascara: dados ? decodificar(dados) : null,
          bytes: dados && Number.isFinite(dados.bytes) ? dados.bytes : 0,
          loading: false,
          error: null,
        });
      },
      /* O erro sobe CRU: a tela distingue `permission-denied` de queda de rede. */
      (err) => setEstado({ mascara: null, bytes: 0, loading: false, error: err }),
    );
    return () => unsub();
  }, [uid, mapId]);

  return estado;
}

/**
 * A gravação da névoa com debounce, pronta para o pincel e para a viagem.
 *
 * `agendar(mascara)` pode ser chamado a cada movimento do ponteiro: só a
 * última chamada de cada janela de `espera` vira escrita. `salvarAgora()`
 * força o flush (o botão "salvar" e a desmontagem usam isso).
 *
 * A máscara é guardada por REFERÊNCIA e serializada só na hora de gravar —
 * como as operações de `fogMask` mutam em lugar, isso garante que o que vai
 * ao banco é o estado final do traço, não um retrato do meio dele.
 *
 * @param {string} uid
 * @param {string} mapId
 * @param {{espera?:number}} [opcoes]
 * @returns {{agendar:Function, salvarAgora:Function, gravando:boolean, pendente:boolean, erro:Error|null, bytes:number, limparErro:Function}}
 */
export function useSalvarFog(uid, mapId, opcoes = {}) {
  const espera = Number.isFinite(opcoes.espera) && opcoes.espera >= 0 ? opcoes.espera : ESPERA_DA_NEVOA;

  const [gravando, setGravando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState(null);
  const [bytes, setBytes] = useState(0);

  const alvo = useRef(null);       // a máscara a gravar
  const timer = useRef(null);
  const vivo = useRef(true);
  const contexto = useRef({ uid, mapId });
  contexto.current = { uid, mapId };

  const gravar = useCallback(async () => {
    const mascara = alvo.current;
    const { uid: u, mapId: m } = contexto.current;
    alvo.current = null;
    if (!mascara || !u || !m) { if (vivo.current) setPendente(false); return; }

    if (vivo.current) { setGravando(true); setPendente(false); }
    try {
      const { bytes: gravados } = await salvarFog(u, m, mascara);
      if (vivo.current) { setBytes(gravados); setErro(null); }
    } catch (err) {
      console.error("[fogStore] a névoa não foi gravada:", err);
      if (vivo.current) setErro(err);
    } finally {
      if (vivo.current) setGravando(false);
    }
  }, []);

  const agendar = useCallback((mascara) => {
    alvo.current = mascara || null;
    if (!mascara) return;
    setPendente(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; gravar(); }, espera);
  }, [espera, gravar]);

  const salvarAgora = useCallback((mascara) => {
    if (mascara) alvo.current = mascara;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    return gravar();
  }, [gravar]);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      /* Flush ao desmontar: fechar o editor no meio de um traço não pode
         custar o traço. Sem `vivo`, nenhum `setState` acontece depois — a
         gravação segue sozinha e o React não reclama. */
      gravar();
    };
  }, [gravar]);

  const limparErro = useCallback(() => setErro(null), []);

  return { agendar, salvarAgora, gravando, pendente, erro, bytes, limparErro };
}
