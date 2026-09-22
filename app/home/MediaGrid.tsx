"use client";

import Image from "next/image";
import type { MediaImage } from "@/lib/mock/social-db";

const TILE_STYLE = { width: "100%", height: "100%", objectFit: "cover" as const, display: "block" as const };

export default function MediaGrid({
  items,
  onOpen,
}: {
  items: MediaImage[];
  onOpen: (index: number) => void;
}) {
  const count = items.length;
  const visible = items.slice(0, 4);
  const remaining = count - 4;

  return (
    <>
      {count === 1 && (
        <button type="button" className="grid grid1" onClick={() => onOpen(0)}>
          <span className="tileImg">
            <Image
              src={items[0].src}
              alt={items[0].alt}
              width={800}
              height={456}
              style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
            />
          </span>
        </button>
      )}

      {count === 2 && (
        <div className="grid grid2">
          {items.map((item, i) => (
            <button type="button" key={i} className="tile" onClick={() => onOpen(i)}>
              <span className="tileImg">
                <Image src={item.src} alt={item.alt} width={400} height={220} style={TILE_STYLE} />
              </span>
            </button>
          ))}
        </div>
      )}

      {count === 3 && (
        <div className="grid grid3">
          <button type="button" className="tile tileMain" onClick={() => onOpen(0)}>
            <span className="tileImg">
              <Image src={items[0].src} alt={items[0].alt} width={400} height={240} style={TILE_STYLE} />
            </span>
          </button>
          <button type="button" className="tile tileTR" onClick={() => onOpen(1)}>
            <span className="tileImg">
              <Image src={items[1].src} alt={items[1].alt} width={400} height={119} style={TILE_STYLE} />
            </span>
          </button>
          <button type="button" className="tile tileBR" onClick={() => onOpen(2)}>
            <span className="tileImg">
              <Image src={items[2].src} alt={items[2].alt} width={400} height={119} style={TILE_STYLE} />
            </span>
          </button>
        </div>
      )}

      {count >= 4 && (
        <div className="grid grid4">
          {visible.map((item, i) => {
            const isOverflowTile = i === 3 && remaining > 0;
            return (
              <button type="button" key={i} className="tile" onClick={() => onOpen(i)}>
                <span className="tileImg">
                  <Image src={item.src} alt={item.alt} width={400} height={180} style={TILE_STYLE} />
                </span>
                {isOverflowTile && <span className="moreOverlay">+{remaining}</span>}
              </button>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .grid {
          display: grid;
          gap: 8px;
        }

        .grid1 {
          display: block;
          width: 100%;
          border: none;
          padding: 0;
          background: none;
          cursor: pointer;
          overflow: hidden;
        }

        .grid2 {
          grid-template-columns: 1fr 1fr;
          height: 220px;
        }

        .grid3 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          height: 240px;
        }

        .tileMain {
          grid-column: 1;
          grid-row: 1 / 3;
        }

        .tileTR {
          grid-column: 2;
          grid-row: 1;
        }

        .tileBR {
          grid-column: 2;
          grid-row: 2;
        }

        .grid4 {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          aspect-ratio: 1 / 1;
        }

        .tile {
          position: relative;
          border: none;
          padding: 0;
          background: none;
          cursor: pointer;
          overflow: hidden;
          width: 100%;
          height: 100%;
        }

        .tileImg {
          display: block;
          width: 100%;
          height: 100%;
          transition: transform 0.3s ease;
        }

        .tile:hover .tileImg,
        .grid1:hover .tileImg {
          transform: scale(1.06);
        }

        .moreOverlay {
          position: absolute;
          inset: 0;
          background: rgba(13, 30, 56, 0.6);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Space Grotesk", sans-serif;
          font-weight: 600;
          font-size: 22px;
        }
      `}</style>
    </>
  );
}
