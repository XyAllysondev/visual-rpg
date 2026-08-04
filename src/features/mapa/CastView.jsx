import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import MapEditor from "../../components/MapEditor";
import Shell from "../../lib/appShell";

/* ── ROTA DE TRANSMISSÃO: /cast/{campaignId} (doc Owlbear /docs/casting) ──
 * Janela dedicada para jogar em mesa presencial: você abre numa segunda tela (TV) e ela
 * mostra a mesa em **VISÃO DE JOGADOR** — `isMaster={false}` mesmo estando logado como
 * mestre, então a névoa fica opaca na TV, que é justamente o ponto (no Owlbear o
 * dispositivo de transmissão entra como jogador e não vê através da névoa).
 * Sem chrome do app: é mapa em tela cheia. A câmera acompanha o mestre pelo Sync View que
 * já existe, porque a TV normalmente não recebe input. */
function CastView({ campaignId }) {
  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  const [ready, setReady] = useState(!!auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, u => { setUid(u?.uid || null); setReady(true); }), []);

  const center = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07070d', color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', padding: 24 };

  if (!ready) return (<><Shell/><div style={center}><div style={{ width: 32, height: 32, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div></>);
  if (!uid) return (<><Shell/><div style={center}>Entre na mesma conta neste navegador para transmitir a mesa.</div></>);

  return (
    <><Shell/>
      <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
        <MapEditor campaignId={campaignId} uid={uid} isMaster={false} db={db} />
      </div>
    </>
  );
}

export default CastView;
