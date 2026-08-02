import { useState, useEffect } from "react";
import * as charactersRepo from "../infrastructure/firestore/charactersRepo";
import { isSameCharacter as isSameChar } from "../domain/character";

// Falhas de Firestore NÃO são engolidas em silêncio (assessment-0021 grupo C): o repositório
// é `strict` — rejeita a Promise — e o hook loga + expõe um flag para a UI avisar o usuário.
// Sem isso, a sincronização entre dispositivos falhava calada e parecia perda de ficha.

export function useCharacter(uid, systemId) {
  const [characters, setCharacters] = useState(() => {
    if (!systemId) return [];
    try { return JSON.parse(localStorage.getItem(`nexus_characters_${systemId}`) || "[]"); }
    catch { return []; }
  });
  const [charsLoading, setCharsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);   // falha ao ler do Firestore (≠ vazio)
  const [saveError, setSaveError] = useState(null);     // mensagem de falha ao salvar (ou null)

  useEffect(() => {
    if (!systemId) { setCharacters([]); return; }
    const key = `nexus_characters_${systemId}`;
    try { setCharacters(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch { setCharacters([]); }
    if (!uid) return;
    setCharsLoading(true);
    setLoadError(false);
    charactersRepo.listBySystem(uid, systemId).then(fsChars => {
      setCharsLoading(false);
      if (fsChars.length > 0) {
        setCharacters(fsChars);
        try { localStorage.setItem(key, JSON.stringify(fsChars)); } catch (e) { console.error("[useCharacter] localStorage:", e); }
      }
    }).catch(e => {
      setCharsLoading(false);
      setLoadError(true);
      console.error("[useCharacter] falha ao carregar fichas do Firestore:", e);
    });
  }, [uid, systemId]);

  useEffect(() => {
    if (!systemId) return;
    try { localStorage.setItem(`nexus_characters_${systemId}`, JSON.stringify(characters)); }
    catch (e) {
      console.error("[useCharacter] falha ao salvar fichas no localStorage (quota?):", e);
      setSaveError("Armazenamento local cheio — remova imagens grandes das fichas.");
    }
  }, [characters, systemId]);

  const saveCharacter = (char) => {
    setCharacters(prev => {
      const exists = prev.some(c => isSameChar(c, char));
      return exists ? prev.map(c => isSameChar(c, char) ? char : c) : [...prev, char];
    });
    charactersRepo.save(uid, char)
      .then(() => setSaveError(null))
      .catch(e => {
        console.error("[useCharacter] falha ao salvar ficha no Firestore:", e);
        setSaveError("Falha ao salvar na nuvem — a ficha está salva neste dispositivo, mas pode não sincronizar.");
      });
  };

  const deleteCharacter = (char) => {
    setCharacters(prev => prev.filter(c => !isSameChar(c, char)));
    charactersRepo.remove(uid, char).catch(e => console.error("[useCharacter] falha ao excluir ficha no Firestore:", e));
  };

  return { characters, setCharacters, charsLoading, loadError, saveError, clearSaveError: () => setSaveError(null), saveCharacter, deleteCharacter };
}
