import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import * as usersRepo from "../infrastructure/firestore/usersRepo";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
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
    signOut(auth);
  };

  return { currentUser, authLoading, userName, userPhoto, logout };
}
