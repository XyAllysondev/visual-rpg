import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import * as usersRepo from "../infrastructure/firestore/usersRepo";
import { DEMO_ON, USUARIO_DEMO, sairDoDemo } from "../demo/demoMode";

export function useAuth() {
  /* Modo demo (`?demo=1` em dev): entra com um usuário falso e NÃO fala com o
     Firebase Auth. O `if` fica dentro do hook, não antes dele — early return
     mudaria a ordem dos hooks. Fora da demo, tudo igual ao que era. */
  const [currentUser, setCurrentUser] = useState(DEMO_ON ? USUARIO_DEMO : null);
  const [authLoading, setAuthLoading] = useState(!DEMO_ON);

  useEffect(() => {
    if (DEMO_ON) return undefined;
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user || null);
      setAuthLoading(false);
      if (user) usersRepo.ensureDoc(user.uid, user.email || "");
    });
    return unsub;
  }, []);

  const userName =
    localStorage.getItem("nexus_profile_name") ||
    currentUser?.displayName ||
    "Agente";

  const userPhoto =
    localStorage.getItem("nexus_profile_photo") ||
    currentUser?.photoURL ||
    "";

  const logout = () => {
    localStorage.removeItem("nexus_system");
    localStorage.removeItem("nexus_screen");
    if (DEMO_ON) { sairDoDemo(); return; }   // sair da demo = voltar ao app normal
    signOut(auth);
  };

  return { currentUser, authLoading, userName, userPhoto, logout };
}
