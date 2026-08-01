/* Forja do Mestre — CARD DE ENTIDADE (spec 0027, AC-3/AC-4/AC-8).
 *
 * Faixa da cor do tipo + capa (ou sigilo) + selo + nome + resumo + tags. O hover/foco (levantar
 * 2px e acender o glow) vem da classe `.forja-card` do `<ForjaStyles/>`; aqui só entram os tokens
 * inline e as duas custom properties que dizem QUAL cor acende.
 */
import React from "react";
import { getEntityType } from "../model/entityTypes";
import { SP, R, FS, LINE, SURF, T, tint } from "../ui/tokens";
import { TypeBadge } from "../ui/primitives";
import { EntityIcon } from "../ui/entityIcons";

const clamp2 = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/**
 * @param {{ entity: object, onOpen: () => void, index?: number }} props
 */
export default function EntityCard({ entity, onOpen, index = 0 }) {
  const tipo = getEntityType(entity?.type);
  const tags = Array.isArray(entity?.tags) ? entity.tags : [];
  const abrir = () => { if (typeof onOpen === "function") onOpen(); };

  return (
    <article
      className="forja-card"
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          abrir();
        }
      }}
      aria-label={`${tipo.label}: ${entity?.name || "sem nome"}`}
      style={{
        "--forja-glow": tint(tipo.color, 0.28),
        "--forja-edge": tint(tipo.color, 0.55),
        "--i": Math.min(index, 11),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: "pointer",
        /* Card CLICÁVEL: fundo distinto do canvas + filete `raise`. O dourado
         * aparece só no hover/foco, via `--forja-edge` (aqui ele é legítimo:
         * marca interação). Sem `ELEV.e0` — era um inset branco de 1px que
         * ninguém via e que só sujava o repouso. */
        background: SURF.card,
        border: `1px solid ${LINE.raise}`,
        borderRadius: R.card,
      }}
    >
      {/* faixa do tipo — o discriminador que sobrevive à varredura rápida */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          zIndex: 2,
          background: `linear-gradient(180deg,${tipo.color},${tint(tipo.color, 0.25)})`,
        }}
      />

      {/* Capa proporcional ao dado: com imagem real vale 112px; sem imagem, o
        * sigilo é placeholder e placeholder não pode ser maior que o nome —
        * 84px e um ícone de 30px a 18% de opacidade. */}
      <div
        style={{
          position: "relative",
          height: entity?.imageUrl ? 112 : 84,
          flexShrink: 0,
          background: tint(tipo.color, 0.07),
          borderBottom: `1px solid ${LINE.hair}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {entity?.imageUrl ? (
          <img
            src={entity.imageUrl}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: tipo.color, opacity: 0.18, display: "flex" }}>
            <EntityIcon type={entity?.type} size={30} strokeWidth={1.2} />
          </span>
        )}
      </div>

      {/* corpo */}
      <div
        style={{
          padding: `${SP.x3}px ${SP.x4}px ${SP.x4}px`,
          display: "flex",
          flexDirection: "column",
          gap: SP.x2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <TypeBadge type={entity?.type} />
        <h3 style={{ ...T.cardTitle, ...clamp2, margin: 0 }} title={entity?.name || ""}>
          {entity?.name || "Sem nome"}
        </h3>
        {entity?.description ? (
          <p style={{ ...T.meta, ...clamp2, margin: 0 }}>{entity.description}</p>
        ) : null}
        {tags.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: SP.x1,
              flexWrap: "wrap",
              marginTop: "auto",
              paddingTop: SP.x2,
            }}
          >
            {tags.slice(0, 3).map((tg) => (
              <span
                key={tg}
                style={{
                  ...T.meta,
                  fontSize: FS.micro,
                  padding: `2px ${SP.x2}px`,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${LINE.hair}`,
                  borderRadius: R.tag,
                  color: "var(--muted2)",
                }}
              >
                #{tg}
              </span>
            ))}
            {tags.length > 3 && (
              <span style={{ ...T.meta, fontSize: FS.micro, color: "var(--muted2)" }}>
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
