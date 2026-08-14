import { useState, useEffect } from "react";
import * as campaignsRepo from "../infrastructure/firestore/campaignsRepo";
import * as messagesRepo from "../infrastructure/firestore/messagesRepo";
import {
  generateInviteCode, systemOf, isFull,
  MAX_CAMPAIGNS_PER_SYSTEM, DEFAULT_SYSTEM, DEFAULT_MAX_PLAYERS,
} from "../domain/campaign";
import { DEMO_ON, CAMPANHAS_DEMO } from "../demo/demoMode";

/* Este hook é a camada de APLICAÇÃO da Campanha (spec 0029): ele orquestra o repositório,
   aplica as regras de limite e traduz falha em mensagem PT-BR. O repositório não faz nada
   disso — só lê e escreve. */

const criarCampanha = async (uid, userName, data) => {
  try {
    const system = data.system || DEFAULT_SYSTEM;
    const jaMestra = await campaignsRepo.countActiveByMasterAndSystem(uid, system);
    if (jaMestra >= MAX_CAMPAIGNS_PER_SYSTEM) {
      return { limitError: `Você já possui ${MAX_CAMPAIGNS_PER_SYSTEM} campanhas do sistema "${system}". Exclua uma antes de criar outra.` };
    }
    const code = generateInviteCode();
    const id = await campaignsRepo.create({
      name: data.name,
      description: data.description || "",
      system,
      masterId: uid,
      masterName: userName,
      inviteCode: code,
      members: [uid],
      memberNames: { [uid]: userName },
      isActive: true,
      maxPlayers: data.maxPlayers || DEFAULT_MAX_PLAYERS,
      coverImage: data.coverImage || null,
    });
    return { id, code };
  } catch (e) { console.error("[useCampaign] criar campanha falhou:", e); return null; }
};

const entrarNaCampanha = async (uid, userName, code) => {
  try {
    const camp = await campaignsRepo.findActiveByInviteCode(code);
    if (!camp) return { error: "Código inválido ou campanha não encontrada." };
    // `?.` de propósito: a validação de fronteira (spec 0032 AC-6) garante o TIPO de `members`,
    // mas não inventa PRESENÇA — documento sem o campo continua chegando sem ele, e aqui isso
    // dava `TypeError` no meio do fluxo de entrada. Sem membros, ninguém é membro; o
    // `addMember` logo abaixo cria o array com `arrayUnion`.
    if (camp.members?.includes(uid)) return { error: "Você já é membro desta campanha." };
    if (isFull(camp)) return { error: "Campanha lotada." };

    const system = systemOf(camp);
    const jaJoga = await campaignsRepo.countActiveByMemberAndSystem(uid, system);
    if (jaJoga >= MAX_CAMPAIGNS_PER_SYSTEM) {
      return { error: `Você já participa de ${MAX_CAMPAIGNS_PER_SYSTEM} campanhas do sistema "${system}".` };
    }

    await campaignsRepo.addMember(camp.id, uid, userName);
    await messagesRepo.sendSystem(camp.id, `${userName} entrou na campanha.`);
    return { id: camp.id };
  } catch (e) { console.error("[useCampaign] entrar na campanha falhou:", e); return { error: "Erro ao entrar na campanha." }; }
};

const sairDaCampanha = async (campId, uid) => {
  try {
    await campaignsRepo.removeMember(campId, uid);
  } catch (e) { console.error("[useCampaign] sair da campanha falhou:", e); }
};

export function useCampaign(uid, userName) {
  const [campaigns, setCampaigns] = useState(DEMO_ON ? CAMPANHAS_DEMO : []);
  const [campsLoading, setCampsLoading] = useState(false);
  const [subKey, setSubKey] = useState(0);

  useEffect(() => {
    /* Demo: as mesas vêm do módulo de demonstração, sem listener no Firestore.
       Criar/entrar/sair continuam funcionando — só que em memória (abaixo). */
    if (DEMO_ON) return undefined;
    if (!uid) { setCampaigns([]); return; }
    setCampsLoading(true);
    // O backoff de 5 s para reassinar é POLÍTICA DE UI e mora aqui, não no repositório
    // (spec 0029, design §"Onde a lógica de negócio fica").
    const unsub = campaignsRepo.watchByMember(uid, (list) => {
      setCampaigns(list);
      setCampsLoading(false);
    }, () => {
      setCampaigns([]);
      setCampsLoading(false);
      setTimeout(() => setSubKey(k => k + 1), 5000);
    });
    return unsub;
  }, [uid, subKey]);

  /* ── Escritas no modo demo ────────────────────────────────────────────
     Rodam contra o estado em memória em vez do Firestore, mas passam pelas
     MESMAS regras de domínio (cota por sistema, lotação, código de convite),
     senão a demo mentiria sobre o comportamento do produto. */
  const createCampaign = async (data) => {
    if (DEMO_ON) {
      const system = data.system || DEFAULT_SYSTEM;
      const jaMestra = campaigns.filter(c => c.masterId === uid && systemOf(c) === system && c.isActive !== false).length;
      if (jaMestra >= MAX_CAMPAIGNS_PER_SYSTEM) {
        return { limitError: `Você já possui ${MAX_CAMPAIGNS_PER_SYSTEM} campanhas do sistema "${system}". Exclua uma antes de criar outra.` };
      }
      const code = generateInviteCode();
      const id = `demo-camp-${Date.now()}`;
      setCampaigns(prev => [...prev, {
        id, name: data.name, description: data.description || "", system,
        masterId: uid, masterName: userName, inviteCode: code,
        members: [uid], memberNames: { [uid]: userName }, isActive: true,
        maxPlayers: data.maxPlayers || DEFAULT_MAX_PLAYERS,
        coverImage: data.coverImage || null,
      }]);
      return { id, code };
    }
    const r = await criarCampanha(uid, userName, data);
    if (r && !r.limitError) setSubKey(k => k + 1);
    return r;
  };

  const joinCampaign = async (code) => {
    if (DEMO_ON) {
      const alvo = campaigns.find(c => c.inviteCode === String(code || "").trim().toUpperCase() && c.isActive !== false);
      if (!alvo) return { error: "Código inválido ou campanha não encontrada." };
      if (alvo.members.includes(uid)) return { error: "Você já é membro desta campanha." };
      if (isFull(alvo)) return { error: "Campanha lotada." };
      setCampaigns(prev => prev.map(c => c.id === alvo.id
        ? { ...c, members: [...c.members, uid], memberNames: { ...c.memberNames, [uid]: userName } }
        : c));
      return { id: alvo.id };
    }
    const r = await entrarNaCampanha(uid, userName, code);
    if (!r?.error) setSubKey(k => k + 1);
    return r;
  };

  const leaveCampaign = async (campId) => {
    if (DEMO_ON) {
      setCampaigns(prev => prev.map(c => c.id === campId
        ? { ...c, members: c.members.filter(m => m !== uid) }
        : c));
      return;
    }
    await sairDaCampanha(campId, uid);
    setSubKey(k => k + 1);
  };

  return { campaigns, campsLoading, createCampaign, joinCampaign, leaveCampaign };
}
