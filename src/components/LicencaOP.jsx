import React from "react";

/* Avisos obrigatórios da Licença da Comunidade de Ordem Paranormal
 * (https://ordemparanormal.com.br/licenca — spec 0003).
 * O texto legal é fixo em pt-BR: a licença exige a frase exata, independente do locale. */
export const TEXTO_NAO_OFICIAL =
  "Este é um conteúdo não oficial, publicado sob a Licença da Comunidade de Ordem Paranormal.";
export const TEXTO_IA = "Contém material gerado por inteligência artificial.";

const SELO_SRC = process.env.PUBLIC_URL + "/selo-conteudo-nao-oficial.png";

/* variant="footer": selo pequeno + texto, para o rodapé global.
 * variant="ficha": selo com largura ≥10% do container (mín. 48px), exigência da licença para capas. */
export default function LicencaOP({ variant = "footer", style }) {
  const ficha = variant === "ficha";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ficha ? 12 : 10, minWidth: 0, opacity: 1, ...style }}>
      <img
        src={SELO_SRC}
        alt="Selo Conteúdo Não Oficial — Licença da Comunidade de Ordem Paranormal"
        style={ficha
          ? { width: "10%", minWidth: 48, maxWidth: 120, height: "auto", flexShrink: 0 }
          : { width: 30, height: "auto", flexShrink: 0 }}
      />
      {/* Aviso legal: prioriza legibilidade (fonte de texto, não a display/mono
       * decorativa) — a licença exige que a frase seja lida, não enfeitada. */}
      <span style={{
        fontSize: ficha ? 12 : 11.5, lineHeight: 1.5, color: "var(--muted2, #c8b48e)",
        fontFamily: "var(--font-body,'Inter','Segoe UI',sans-serif)",
        letterSpacing: "0.01em", minWidth: 0,
      }}>
        {TEXTO_NAO_OFICIAL}
      </span>
    </div>
  );
}
