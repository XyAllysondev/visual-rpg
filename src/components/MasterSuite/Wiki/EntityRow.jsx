/* Forja do Mestre — LINHA DA WIKI EM MODO LISTA (spec 0027, AC-4/AC-8).
 * Mesma informação do card, densidade de varredura. O grid (`.forja-row`) e o colapso em duas
 * linhas no mobile vêm do `<ForjaStyles/>`; abaixo de 768px a coluna de tipo some e o rótulo
 * migra para a linha de metadados (`.wk-only-mobile`).
 */
import React from "react";
import { getEntityType } from "../model/entityTypes";
import { SP, FS, HIT, LINE, SURF, T, tempoRelativo } from "../ui/tokens";
import { EntityIcon } from "../ui/entityIcons";

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

/**
 * @param {{ entity: object, onOpen: () => void }} props
 */
export default function EntityRow({ entity, onOpen }) {
  const tipo = getEntityType(entity?.type);
  const tags = Array.isArray(entity?.tags) ? entity.tags : [];
  const abrir = () => { if (typeof onOpen === "function") onOpen(); };

  return (
    <div
      className="forja-row forja-row-item forja-focus"
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
        minHeight: HIT.mobile + 12,
        padding: `${SP.x2}px ${SP.x3}px`,
        cursor: "pointer",
        borderBottom: `1px solid ${LINE.hair}`,
        /* 2px, não 3: a 3px a faixa competia com o ícone colorido ao lado */
        borderLeft: `2px solid ${tipo.color}`,
        background: SURF.card,
      }}
    >
      <span className="r-icon" style={{ color: tipo.color, display: "flex" }}>
        <EntityIcon type={entity?.type} size={20} />
      </span>

      <span
        className="r-name"
        style={{ ...T.cardTitle, fontSize: FS.body, ...ellipsis }}
        title={entity?.name || ""}
      >
        {entity?.name || "Sem nome"}
      </span>

      <span className="r-type" style={{ ...T.typeTag, color: tipo.color, ...ellipsis }}>
        {tipo.label}
      </span>

      <span
        className="r-meta"
        style={{ ...T.meta, fontSize: FS.micro, color: "var(--muted2)", ...ellipsis }}
      >
        <span className="wk-only-mobile" style={{ color: tipo.color }}>
          {tipo.label}
          {tags.length ? " · " : ""}
        </span>
        {tags.map((t) => `#${t}`).join(" ")}
      </span>

      <span className="r-time" style={{ ...T.data, fontSize: FS.micro, textAlign: "right" }}>
        {tempoRelativo(entity?.updatedAt)}
      </span>
    </div>
  );
}
