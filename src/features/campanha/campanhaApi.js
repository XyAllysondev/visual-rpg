import * as messagesRepo from "../../infrastructure/firestore/messagesRepo";
import * as sharedSheetsRepo from "../../infrastructure/firestore/sharedSheetsRepo";

/* Envio de mensagem: assinatura de conveniência sobre o `messagesRepo`. Existe só para
   não reescrever os 8 pontos de chamada que já passavam os campos posicionalmente. */
const fsSendMessage = (campaignId, uid, userName, userPhoto, content, type, rollData) =>
  messagesRepo.send(campaignId, { userId: uid, userName, userPhoto, content, type, rollData });

/* Compartilhar ficha na mesa: conveniência posicional sobre o `sharedSheetsRepo`. */
const fsShareSheet = (campaignId, uid, userName, character, isLive) =>
  sharedSheetsRepo.share(campaignId, { uid, userName, character, isLive });

export { fsSendMessage, fsShareSheet };
