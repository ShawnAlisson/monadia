"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Billboard text label rendered to a canvas texture.
 * Avoids troika-three-text (incompatible with three r185) and supports emoji.
 */
export function TextSprite({
  text,
  color = "#e8f4f1",
  height = 0.5,
  position = [0, 0, 0],
  maxWidthChars = 46,
}: {
  text: string;
  color?: string;
  height?: number;
  position?: [number, number, number];
  maxWidthChars?: number;
}) {
  const clipped = text.length > maxWidthChars ? text.slice(0, maxWidthChars - 1) + "…" : text;

  const { texture, aspect } = useMemo(() => {
    const fontPx = 64;
    const pad = 24;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `600 ${fontPx}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(clipped).width) + pad * 2;
    const h = fontPx + pad * 2;
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // soft dark backdrop for readability
    ctx.fillStyle = "rgba(3, 7, 12, 0.55)";
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 18);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(3, 7, 12, 0.9)";
    ctx.strokeText(clipped, w / 2, h / 2 + 2);
    ctx.fillStyle = color;
    ctx.fillText(clipped, w / 2, h / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    return { texture: tex, aspect: w / h };
  }, [clipped, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
