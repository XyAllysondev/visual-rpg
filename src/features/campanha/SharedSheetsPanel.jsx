import { useState, useEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import * as sharedSheetsRepo from "../../infrastructure/firestore/sharedSheetsRepo";
import { getActiveAvatar } from "../../domain/character";
import SharedSheetCard from "./SharedSheetCard";
import { fsSendMessage, fsShareSheet } from "./campanhaApi";
import { FullSheet } from "../ficha";
import { fichaDoSistema } from "../../lib/lazySystemSheets";

/* A mesa abria SEMPRE a FullSheet legada, qualquer que fosse o sistema — então um
 * agente de Ordem Paranormal aparecia para a campanha numa ficha diferente da que
 * o jogador usa: sem elemento de afinidade, sem aba de progressão, sem arsenal v2.
 * A visão pública (`features/ficha/PublicSheetView`) já roteava certo; aqui não.
 * A FullSheet fica como destino de quem não tem ficha própria de sistema. */
const fichaDaMesa = (dados) => fichaDoSistema(dados) || FullSheet;

/* Os três ajustes de privacidade moravam DENTRO da ficha legada. Como a mesa
 * deixou de abri-la para Ordem Paranormal, eles subiram para cá — senão o dono
 * perderia o único lugar do app onde consegue mexer neles. Só o dono vê a barra:
 * a escolha é dele, e é ela que este painel lê para esconder ficha privada e para
 * decidir quem edita. Texto herdado da ficha legada, de propósito. */
const AJUSTES = [
  { campo: "isPrivate", padrao: false, label: "Ficha privada",
    desc: "Apenas você e o mestre da campanha poderão visualizar a ficha." },
  { campo: "allowMasterEdit", padrao: true, label: "Permitir que o Mestre da campanha edite minha ficha" },
  { campo: "allowAnyEdit", padrao: false, label: "Permitir que qualquer pessoa edite minha ficha",
    desc: "Atenção: com essa opção ligada qualquer pessoa da campanha pode editar sua ficha." },
];

function BarraPrivacidade({ dados, onChange }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border2)", background: "var(--card)", display: "flex", gap: 22, flexWrap: "wrap" }}>
      {AJUSTES.map(({ campo, padrao, label, desc }) => {
        const val = dados?.[campo] ?? padrao;
        return (
          <div key={campo} style={{ minWidth: 200, flex: "1 1 220px" }}>
            <div style={{ fontFamily: "Cinzel,serif", fontSize: 11, color: "var(--text)", marginBottom: 4 }}>{label}</div>
            {desc && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, lineHeight: 1.45 }}>{desc}</div>}
            <div style={{ display: "inline-flex", border: "1px solid var(--border2)", borderRadius: 6, overflow: "hidden" }}>
              {[[false, "DESLIGADO"], [true, "LIGADO"]].map(([v, txt]) => (
                <button key={txt} onClick={() => onChange(campo, v)} aria-pressed={val === v}
                  style={{ padding: "6px 14px", background: val === v ? "#8b5cf6" : "transparent", border: "none", cursor: "pointer",
                    fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 1, color: val === v ? "#fff" : "#666" }}>{txt}</button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SharedSheetsPanel({ campaignId, uid, userName, isMaster, characters }) {
  const [sharedSheets, setSharedSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [viewSheet, setViewSheet] = useState(null);
  const sharedSheetsRef = useRef([]);

  const SHEET_LIMIT = 15;

  useEffect(()=>{
    const unsub = sharedSheetsRepo.watchByCampaign(campaignId, docs=>{
      setSharedSheets(docs);
      sharedSheetsRef.current = docs;
      setLoading(false);
    });
    return unsub;
  },[campaignId]);

  // Sync "Ao Vivo" sheets: whenever characters change or panel finishes loading,
  // push latest character data to Firestore so other members see live updates.
  useEffect(()=>{
    if (loading || !characters?.length) return;
    const myLiveSheets = sharedSheetsRef.current.filter(s => s.ownerId === uid && s.isLive);
    if (!myLiveSheets.length) return;
    myLiveSheets.forEach(sheet => {
      const char = characters.find(c => String(c.id || c.createdAt) === sheet.characterId);
      if (!char) return;
      sharedSheetsRepo.updateCharacterData({ campaignId, sheetId: sheet.id }, char);
    });
    // `campaignId` e `uid` ficam de fora: trocar de campanha ou de usuário
    // remonta este painel inteiro, e listá-los só faria o live-sync reescrever
    // fichas sem que nada tivesse mudado nelas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[characters, loading]);

  const handleShare = async (character, isLive) => {
    if (sharedSheets.length >= SHEET_LIMIT) return;
    const sheetId = await fsShareSheet(campaignId,uid,userName,character,isLive);
    if (sheetId) {
      await fsSendMessage(campaignId,"system","Sistema",null,
        `${userName} compartilhou a ficha de ${character.form?.personagem||"um personagem"}.`,
        "system",null);
    }
    setSharing(false);
  };

  const handleRemove = async (sheetId) => {
    await sharedSheetsRepo.remove(campaignId, sheetId);
  };

  // Visibility: hide private sheets from non-owner non-master members
  const visibleSheets = sharedSheets.filter(s =>
    s.ownerId === uid || isMaster || !s.characterData?.isPrivate
  );

  // Edit permission for a given sheet
  const canEditSheet = (sheet) => {
    if (sheet.ownerId === uid) return true;
    if (isMaster && sheet.characterData?.allowMasterEdit !== false) return true;
    if (sheet.characterData?.allowAnyEdit === true) return true;
    return false;
  };

  // Save edits made by master/member to the sharedSheets document
  const handleSheetUpdate = async (sheet, updated) => {
    try {
      // `fallbackName` preserva a diferença herdada: aqui o nome cai para o que a ficha
      // JÁ tinha na mesa, não para "Sem nome" como no live-sync (spec 0029 AC-7).
      await sharedSheetsRepo.updateCharacterData(
        { campaignId, sheetId: sheet.id }, updated, { fallbackName: sheet.characterName }
      );
    } catch(e) { console.error(e); }
  };

  const mySharedCharIds = sharedSheets.filter(s=>s.ownerId===uid).map(s=>s.characterId);
  const availableChars = characters.filter(c=>!mySharedCharIds.includes(String(c.id||c.createdAt)));
  const atLimit = sharedSheets.length >= SHEET_LIMIT;
  const btnDisabled = atLimit || availableChars.length === 0;
  const btnTitle = atLimit
    ? "Limite de 15 fichas atingido"
    : availableChars.length === 0
      ? characters.length === 0
        ? "Crie um personagem primeiro"
        : "Todas as suas fichas já estão compartilhadas"
      : "";

  return (
    <div style={{overflowY:"auto",padding:"16px 4px",display:"flex",flexDirection:"column",gap:16}}>
      {/* Header row: counter + share button */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>
            Fichas Compartilhadas
          </div>
          <div style={{
            padding:"2px 9px",borderRadius:20,
            background: atLimit ? "rgba(224,112,112,0.12)" : "rgba(176,48,216,0.1)",
            border: `1px solid ${atLimit ? "rgba(224,112,112,0.3)" : "rgba(176,48,216,0.25)"}`,
            fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,
            color: atLimit ? "#e07070" : "var(--purple2)",
          }}>
            {sharedSheets.length}/{SHEET_LIMIT}
          </div>
          {atLimit && (
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase"}}>
              Limite atingido
            </div>
          )}
        </div>
        {!sharing && (
          <button
            onClick={()=>{ if(!btnDisabled) setSharing(true); }}
            disabled={btnDisabled}
            title={btnTitle}
            className="btn-gold"
            style={{
              padding:"8px 18px",fontSize:10,
              opacity: btnDisabled ? 0.42 : 1,
              cursor: btnDisabled ? "not-allowed" : "pointer",
            }}>
            + Compartilhar Ficha
          </button>
        )}
      </div>

      {/* No characters hint */}
      {!sharing && characters.length === 0 && (
        <div style={{padding:"10px 14px",background:"rgba(176,48,216,0.06)",border:"1px solid rgba(176,48,216,0.18)",borderRadius:8,fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted)",fontStyle:"italic",textAlign:"center"}}>
          Crie um personagem na aba <strong style={{fontStyle:"normal",color:"var(--purple2)"}}>Fichas</strong> para poder compartilhar nesta campanha.
        </div>
      )}

      {sharing && (
        <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>Escolha uma Ficha para Compartilhar</div>
          {availableChars.length === 0 ? (
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted)",fontStyle:"italic",textAlign:"center",padding:"16px 0"}}>
              Todas as suas fichas já estão compartilhadas nesta campanha.
            </div>
          ) : availableChars.map(c=>(
            <div key={c.id||c.createdAt} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--card2)",borderRadius:6,border:"1px solid var(--border)",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:6,background:"rgba(176,48,216,0.1)",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",fontSize:18}}>
                  {getActiveAvatar(c)?<img src={getActiveAvatar(c)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🕵️"}
                </div>
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--text)"}}>{c.form?.personagem||"Sem nome"}</div>
                  <div style={{fontFamily:"'Crimson Pro',serif",fontSize:12,color:"var(--muted)"}}>{c.classe?.name||"—"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>handleShare(c,false)} className="btn-ghost" style={{padding:"6px 12px",fontSize:9}} title="Foto do estado atual — não atualiza automaticamente">Snapshot</button>
                <button onClick={()=>handleShare(c,true)} className="btn-gold" style={{padding:"6px 12px",fontSize:9}} title="Sempre reflete os dados atuais do personagem">● Ao Vivo</button>
              </div>
            </div>
          ))}
          <button onClick={()=>setSharing(false)} className="btn-ghost" style={{alignSelf:"flex-end",padding:"6px 14px",fontSize:9}}>Cancelar</button>
        </div>
      )}

      {loading && (
        <div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}>
          <div style={{width:24,height:24,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        </div>
      )}

      {!loading && sharedSheets.length===0 && !sharing && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:180,gap:10,opacity:0.45,textAlign:"center"}}>
          <div style={{fontSize:32}}>◈</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>Nenhuma ficha compartilhada</div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted)",fontStyle:"italic"}}>
            Compartilhe uma ficha para que a campanha possa acompanhar seu personagem.
          </div>
        </div>
      )}

      {visibleSheets.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
          {visibleSheets.map(sheet=>(
            <SharedSheetCard key={sheet.id} sheet={sheet} uid={uid} isMaster={isMaster}
              onView={()=>setViewSheet(sheet)} onRemove={()=>handleRemove(sheet.id)}/>
          ))}
        </div>
      )}

      {viewSheet && (() => {
        /* Lê a versão VIVA do documento: `viewSheet` é a foto do clique, e sem
         * isto um ajuste de privacidade só apareceria ao fechar e reabrir. */
        const atual = sharedSheets.find(s => s.id === viewSheet.id) || viewSheet;
        const dados = atual.characterData;
        const Ficha = fichaDaMesa(dados);
        const podeEditar = canEditSheet(atual);
        const ehDono = atual.ownerId === uid;
        return createPortal(
          <div onClick={()=>setViewSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,overflowY:"auto",padding:"20px"}}>
            <div onClick={e=>e.stopPropagation()} style={{maxWidth:960,margin:"0 auto",background:"var(--bg)",borderRadius:10,overflow:"hidden"}}>
              {ehDono && (
                <BarraPrivacidade dados={dados}
                  onChange={(campo, val) => handleSheetUpdate(atual, { ...dados, [campo]: val })} />
              )}
              <Suspense fallback={<div style={{padding:"60px 0",textAlign:"center",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>Abrindo ficha…</div>}>
                {/* Sem `charId`: o bloco de compartilhar/tornar pública é da ficha
                    do DONO, não da cópia que vive na mesa. */}
                <Ficha character={dados} onBack={()=>setViewSheet(null)} readOnly={!podeEditar}
                  onUpdate={podeEditar ? (updated)=>handleSheetUpdate(atual,updated) : ()=>{}}
                  onRoll={roll=>{ fsSendMessage(campaignId,uid,userName,null,
                    `${roll.charName} rolou ${roll.expr||roll.attr} → [${roll.rolls.join(",")}] = ${roll.result}`,
                    "roll",{expr:roll.expr||roll.attr,rolls:roll.rolls,total:roll.result,sides:parseInt((roll.dice||"D20").slice(1)),count:roll.rolls.length,crit:roll.crit});
                  }}/>
              </Suspense>
            </div>
          </div>
        , document.body);
      })()}
    </div>
  );
}

export default SharedSheetsPanel;
