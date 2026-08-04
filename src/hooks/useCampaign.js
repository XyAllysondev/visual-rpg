import { useState, useEffect } from "react";
import * as campaignsRepo from "../infrastructure/firestore/campaignsRepo";
import * as messagesRepo from "../infrastructure/firestore/messagesRepo";
import {
  generateInviteCode, systemOf, isFull,
  MAX_CAMPAIGNS_PER_SYSTEM, DEFAULT_SYSTEM, DEFAULT_MAX_PLAYERS,
} from "../domain/campaign";

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
  const [campaigns, setCampaigns] = useState([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [subKey, setSubKey] = useState(0);

  useEffect(() => {
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

  const createCampaign = async (data) => {
    const r = await criarCampanha(uid, userName, data);
    if (r && !r.limitError) setSubKey(k => k + 1);
    return r;
  };

  const joinCampaign = async (code) => {
    const r = await entrarNaCampanha(uid, userName, code);
    if (!r?.error) setSubKey(k => k + 1);
    return r;
  };

  const leaveCampaign = async (campId) => {
    await sairDaCampanha(campId, uid);
    setSubKey(k => k + 1);
  };

  return { campaigns, campsLoading, createCampaign, joinCampaign, leaveCampaign };
}
