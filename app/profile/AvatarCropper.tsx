"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useBackdropDismiss } from "@/lib/useBackdropDismiss";
import type { AvatarCrop } from "@/lib/avatar";

const MAX_ZOOM = 4;
const KEY_PAN_PX = 12;
const KEY_ZOOM_STEP = 0.1;

type Size = { w: number; h: number };
/** Which part of the photo sits in the circle: its center in photo pixels, and how far it's zoomed in. */
type View = { x: number; y: number; zoom: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Keeps the photo covering the whole circle: no zooming out past it, no dragging an edge into it. */
function fit(view: View, image: Size): View {
  const zoom = clamp(view.zoom, 1, MAX_ZOOM);
  const half = Math.min(image.w, image.h) / zoom / 2;
  return {
    zoom,
    x: clamp(view.x, half, image.w - half),
    y: clamp(view.y, half, image.h - half),
  };
}

export default function AvatarCropper({
  src,
  onCancel,
  onConfirm,
}: {
  /** Object URL of the picked photo. */
  src: string;
  onCancel: () => void;
  onConfirm: (crop: AvatarCrop) => void;
}) {
  const backdrop = useBackdropDismiss(onCancel);
  const stageRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<Size | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  // Rendered width of the square stage, so photo pixels can be turned into screen pixels.
  const [stageSize, setStageSize] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Screen pixels per photo pixel.
  const scale = image && stageSize ? (stageSize * view.zoom) / Math.min(image.w, image.h) : 0;

  function update(change: (view: View) => View) {
    if (image) setView((current) => fit(change(current), image));
  }

  function pan(dx: number, dy: number) {
    if (!scale) return;
    update((v) => ({ ...v, x: v.x - dx / scale, y: v.y - dy / scale }));
  }

  function zoomBy(factor: number) {
    update((v) => ({ ...v, zoom: v.zoom * factor }));
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageSize(entry.contentRect.width));
    observer.observe(stage);
    stage.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Registered by hand: React's wheel listener is passive, so it can't stop the page scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !image) return;
    const loaded = image;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setView((v) => fit({ ...v, zoom: v.zoom * Math.exp(-e.deltaY * 0.002) }, loaded));
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [image]);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    const next = { x: e.clientX, y: e.clientY };

    if (pointers.current.size === 1) {
      pan(next.x - previous.x, next.y - previous.y);
    } else if (pointers.current.size === 2) {
      // Pinch: zoom by how much the gap between the two fingers changed.
      const [other] = [...pointers.current].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) zoomBy(after / before);
    }
    pointers.current.set(e.pointerId, next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
  }

  function onStageKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN_PX, 0],
      ArrowRight: [-KEY_PAN_PX, 0],
      ArrowUp: [0, KEY_PAN_PX],
      ArrowDown: [0, -KEY_PAN_PX],
    };
    if (moves[e.key]) pan(...moves[e.key]);
    else if (e.key === "+" || e.key === "=") zoomBy(1 + KEY_ZOOM_STEP);
    else if (e.key === "-") zoomBy(1 - KEY_ZOOM_STEP);
    else return;
    e.preventDefault();
  }

  function confirm() {
    if (!image) return;
    const size = Math.min(image.w, image.h) / view.zoom;
    onConfirm({ x: view.x - size / 2, y: view.y - size / 2, size });
  }

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(13,30,56,0.55)] p-4 backdrop-blur-[2px]"
      {...backdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatarCropperHeading"
        className="animate-pop-in w-full max-w-[400px] overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_24px_60px_rgba(13,30,56,0.35)]"
      >
        <div className="px-6 pt-5 pb-4">
          <p className="mono mb-1 text-[10.5px] tracking-[0.08em] text-orange">PROFILE PICTURE</p>
          <h2 id="avatarCropperHeading" className="mb-0 text-[20px] leading-tight text-navy-deep">
            Choose what shows
          </h2>
        </div>

        <div className="px-6">
          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Photo crop area. Drag or use the arrow keys to move the photo, plus and minus to zoom."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onStageKeyDown}
            className="relative mx-auto aspect-square w-full max-w-[300px] cursor-grab touch-none overflow-hidden rounded-[6px] bg-navy-deep outline-none select-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 active:cursor-grabbing"
          >
            {/* Plain <img>: a local object URL that's measured and positioned by hand. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => {
                const size = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                setImage(size);
                setView({ x: size.w / 2, y: size.h / 2, zoom: 1 });
              }}
              className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
              style={
                image && scale
                  ? {
                      width: image.w * scale,
                      height: image.h * scale,
                      transform: `translate(${stageSize / 2 - view.x * scale}px, ${stageSize / 2 - view.y * scale}px)`,
                    }
                  : { visibility: "hidden" }
              }
            />
            {/* Dims everything outside the circle the profile picture will show. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(13,30,56,0.6)] ring-2 ring-paper/80"
            />
            {!image && (
              <span className="absolute inset-0 m-auto size-6 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            )}
          </div>

          <div className="mx-auto mt-4 flex max-w-[300px] items-center gap-3 text-ink-soft">
            <button
              type="button"
              onClick={() => zoomBy(1 - KEY_ZOOM_STEP * 2)}
              disabled={!image || view.zoom <= 1}
              aria-label="Zoom out"
              className="flex size-7 shrink-0 items-center justify-center rounded-full transition hover:bg-vellum disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ZoomIcon />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              disabled={!image}
              onChange={(e) => update((v) => ({ ...v, zoom: Number(e.target.value) }))}
              aria-label="Zoom"
              className="h-1 min-w-0 flex-1 cursor-pointer accent-navy"
            />
            <button
              type="button"
              onClick={() => zoomBy(1 + KEY_ZOOM_STEP * 2)}
              disabled={!image || view.zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="flex size-7 shrink-0 items-center justify-center rounded-full transition hover:bg-vellum disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ZoomIcon plus />
            </button>
          </div>
          <p className="mt-2 mb-0 text-center text-[12px] text-ink-soft">
            Drag to reposition. The whole photo still shows when someone opens your picture.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-rule-soft bg-vellum/30 px-6 py-3.5">
          <button type="button" className="btn ghost rounded-lg px-4 py-2 text-[13.5px]" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn rounded-lg px-4 py-2 text-[13.5px] shadow-[0_4px_12px_rgba(13,30,56,0.18)]"
            onClick={confirm}
            disabled={!image}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ZoomIcon({ plus = false }: { plus?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16" y2="16" />
      <line x1="8" y1="11" x2="14" y2="11" />
      {plus && <line x1="11" y1="8" x2="11" y2="14" />}
    </svg>
  );
}
