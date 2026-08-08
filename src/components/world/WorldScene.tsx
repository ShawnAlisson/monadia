"use client";

/* The scene owns an imperative Three.js simulation; mutable refs are intentional here. */
/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/set-state-in-effect */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Grid } from "@react-three/drei";
import { TextSprite } from "./TextSprite";
import type { Business, Citizen, CivilizationEvent } from "@/lib/types";
import {
  POI,
  POI_LABELS,
  agentBuildingPosition,
  businessPosition,
  bubbleText,
  eventColor,
  eventTarget,
  fillerBuildings,
  homePosition,
  rand,
  type PoiKey,
} from "./layout";

/* ------------------------------------------------------------------ */
/* Shared per-agent simulation state (positions live outside React).   */
/* ------------------------------------------------------------------ */

type AgentSim = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  nextThink: number;
  speed: number;
};

type Bubble = { text: string; color: string; start: number };

type PlayerState = {
  pos: THREE.Vector3;
  yaw: number;
  nearby: PoiKey | null;
};

export type WorldSelection =
  | { kind: "citizen"; id: string }
  | { kind: "business"; id: string }
  | null;

const CITIZEN_COLORS = {
  AI: { body: "#0e3b34", glow: "#3de6c1" },
  HUMAN: { body: "#3b2c0e", glow: "#f0b35a" },
} as const;

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

function Avatar({
  citizen,
  sim,
  bubble,
  selected,
  onSelect,
}: {
  citizen: Citizen;
  sim: AgentSim;
  bubble: Bubble | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const colors = CITIZEN_COLORS[citizen.type];
  const phase = useMemo(() => rand(citizen.id, 99) * Math.PI * 2, [citizen.id]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    // steer toward target
    const dx = sim.target.x - sim.pos.x;
    const dz = sim.target.z - sim.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.15) {
      const step = Math.min(dist, sim.speed * dt);
      sim.pos.x += (dx / dist) * step;
      sim.pos.z += (dz / dist) * step;
      g.rotation.y = THREE.MathUtils.lerp(
        g.rotation.y,
        Math.atan2(dx, dz),
        Math.min(1, dt * 6)
      );
    }
    const t = clock.elapsedTime;
    g.position.set(sim.pos.x, 0.15 + Math.sin(t * 2.2 + phase) * 0.08, sim.pos.z);

    // event pulse ring
    if (ringRef.current && bubble) {
      const age = (performance.now() - bubble.start) / 1000;
      const s = 0.6 + (age % 1.4) * 1.6;
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.55 - (age % 1.4) * 0.4
      );
    }
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const showTag = hovered || selected || !!bubble;

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* body */}
      <mesh position={[0, 0.55, 0]} castShadow={false}>
        <capsuleGeometry args={[0.28, 0.55, 4, 10]} />
        <meshStandardMaterial
          color={colors.body}
          emissive={colors.glow}
          emissiveIntensity={hovered || selected ? 0.85 : 0.35}
          roughness={0.4}
        />
      </mesh>
      {/* head / visor */}
      <mesh position={[0, 1.18, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial
          color="#0a1520"
          emissive={colors.glow}
          emissiveIntensity={citizen.type === "AI" ? 1.4 : 0.6}
          roughness={0.25}
        />
      </mesh>
      {/* base ring */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.5, 24]} />
        <meshBasicMaterial
          color={selected ? "#ffffff" : colors.glow}
          transparent
          opacity={selected ? 0.9 : 0.35}
        />
      </mesh>
      {/* event pulse */}
      {bubble && (
        <mesh ref={ringRef} position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.68, 28]} />
          <meshBasicMaterial color={bubble.color} transparent opacity={0.5} />
        </mesh>
      )}
      {/* name tag + bubble */}
      {showTag && (
        <>
          {bubble && (
            <TextSprite
              text={bubble.text}
              color={bubble.color}
              height={0.62}
              position={[0, 2.75, 0]}
            />
          )}
          <TextSprite
            text={`${citizen.type === "AI" ? "🤖" : "👤"} ${citizen.name}`}
            color={citizen.type === "AI" ? "#9dfce8" : "#ffd9a0"}
            height={0.6}
            position={[0, 2, 0]}
          />
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Citizens: owns per-agent sim state + event reactions                */
/* ------------------------------------------------------------------ */

function Citizens({
  citizens,
  events,
  selection,
  onSelect,
  simMap,
}: {
  citizens: Citizen[];
  events: CivilizationEvent[];
  selection: WorldSelection;
  onSelect: (s: WorldSelection) => void;
  simMap: Map<string, AgentSim>;
}) {
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const seenEvents = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  // ensure sim state exists for every citizen
  for (const c of citizens) {
    if (c.type === "AI") continue;
    if (!simMap.has(c.id)) {
      const home = homePosition(c);
      simMap.set(c.id, {
        pos: new THREE.Vector3(home.x, 0, home.z),
        target: new THREE.Vector3(home.x, 0, home.z),
        nextThink: 0,
        speed: 2.2 + rand(c.id, 5) * 1.6,
      });
    }
  }

  // Visible human citizens wander through the world; AI agents are buildings.
  useFrame(() => {
    const now = performance.now();
    for (const c of citizens) {
      if (c.type === "AI") continue;
      const sim = simMap.get(c.id);
      if (!sim || now < sim.nextThink) continue;
      sim.nextThink = now + 4000 + rand(c.id, Math.floor(now / 1000)) * 9000;
      const roll = Math.random();
      if (roll < 0.45) {
        // wander near home
        const home = homePosition(c);
        sim.target.set(
          home.x + (Math.random() - 0.5) * 8,
          0,
          home.z + (Math.random() - 0.5) * 8
        );
      } else if (roll < 0.75) {
        // visit a POI
        const keys = Object.keys(POI) as PoiKey[];
        const poi = POI[keys[Math.floor(Math.random() * keys.length)]];
        sim.target.set(
          poi.x + (Math.random() - 0.5) * 6,
          0,
          poi.z + (Math.random() - 0.5) * 6
        );
      }
      // else: stay put
    }
  });

  // react to new civilization events
  useEffect(() => {
    const byName = new Map(citizens.map((c) => [c.name, c]));
    const fresh: Record<string, Bubble> = {};
    for (const e of events) {
      if (seenEvents.current.has(e.id)) continue;
      seenEvents.current.add(e.id);
      if (firstLoad.current) continue; // don't replay history on first snapshot
      const actor = byName.get(e.actorName);
      if (!actor) continue;
      const sim = simMap.get(actor.id);
      if (!sim) continue;
      const poiKey = eventTarget(e.kind);
      if (poiKey) {
        const poi = POI[poiKey];
        sim.target.set(
          poi.x + (Math.random() - 0.5) * 5,
          0,
          poi.z + (Math.random() - 0.5) * 5
        );
        sim.nextThink = performance.now() + 9000;
      }
      fresh[actor.id] = {
        text: bubbleText(e),
        color: eventColor(e.kind),
        start: performance.now(),
      };
    }
    firstLoad.current = false;
    if (Object.keys(fresh).length) {
      setBubbles((prev) => ({ ...prev, ...fresh }));
      const ids = Object.keys(fresh);
      const timer = setTimeout(() => {
        setBubbles((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            if (next[id] && performance.now() - next[id].start > 5500) delete next[id];
          }
          return next;
        });
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [events, citizens, simMap]);

  return (
    <>
      {citizens.map((c) => {
        const sim = simMap.get(c.id);
        if (c.type === "AI") {
          return (
            <AgentBuilding
              key={c.id}
              citizen={c}
              selected={selection?.kind === "citizen" && selection.id === c.id}
              onSelect={() => onSelect({ kind: "citizen", id: c.id })}
            />
          );
        }
        if (!sim) return null;
        return (
          <Avatar
            key={c.id}
            citizen={c}
            sim={sim}
            bubble={bubbles[c.id] ?? null}
            selected={selection?.kind === "citizen" && selection.id === c.id}
            onSelect={() => onSelect({ kind: "citizen", id: c.id })}
          />
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Landmarks                                                           */
/* ------------------------------------------------------------------ */

function PoiLabel({ poi }: { poi: PoiKey }) {
  const p = POI[poi];
  return (
    <TextSprite
      text={POI_LABELS[poi]}
      color="#6ee9d0"
      height={1.15}
      position={[p.x, 6.6, p.z]}
    />
  );
}

function MarketPlaza() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.25;
  });
  const p = POI.MARKET;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow={false}>
        <cylinderGeometry args={[7.5, 8, 0.16, 36]} />
        <meshStandardMaterial color="#0a1826" roughness={0.85} />
      </mesh>
      {/* hologram ring */}
      <mesh ref={ring} position={[0, 3.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.1, 0.06, 10, 64]} />
        <meshStandardMaterial
          color="#3de6c1"
          emissive="#3de6c1"
          emissiveIntensity={1.1}
          transparent
          opacity={0.75}
        />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 3.2, 8]} />
        <meshStandardMaterial color="#0e2233" emissive="#1aa88d" emissiveIntensity={0.5} />
      </mesh>
      {/* kiosks */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4]} rotation={[0, -a, 0]}>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={[1.6, 1.4, 1.2]} />
              <meshStandardMaterial color="#0d1f2e" roughness={0.7} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <boxGeometry args={[1.9, 0.12, 1.5]} />
              <meshStandardMaterial color="#3de6c1" emissive="#3de6c1" emissiveIntensity={1.1} />
            </mesh>
          </group>
        );
      })}
      <PoiLabel poi="MARKET" />
    </group>
  );
}

function Government() {
  const p = POI.GOVERNMENT;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[10, 1, 8]} />
        <meshStandardMaterial color="#0c1a28" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-3.75 + i * 1.5, 2.4, 3.2]}>
          <cylinderGeometry args={[0.28, 0.32, 2.8, 10]} />
          <meshStandardMaterial color="#16293c" emissive="#b085f5" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[10.5, 0.7, 8.5]} />
        <meshStandardMaterial color="#101f30" />
      </mesh>
      <mesh position={[0, 5.4, 0]}>
        <sphereGeometry args={[1.9, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#16293c"
          emissive="#b085f5"
          emissiveIntensity={0.8}
          transparent
          opacity={0.92}
        />
      </mesh>
      <PoiLabel poi="GOVERNMENT" />
    </group>
  );
}

function Farm() {
  const p = POI.FARM;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#0c2416" roughness={1} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-4.8 + i * 2.4, 0.35, 0]}>
          <boxGeometry args={[0.9, 0.7, 10]} />
          <meshStandardMaterial color="#123920" emissive="#8ef05a" emissiveIntensity={0.22} />
        </mesh>
      ))}
      <mesh position={[6.2, 2, -4]}>
        <cylinderGeometry args={[1.1, 1.2, 4, 12]} />
        <meshStandardMaterial color="#13202e" />
      </mesh>
      <mesh position={[6.2, 4.4, -4]}>
        <coneGeometry args={[1.25, 1.2, 12]} />
        <meshStandardMaterial color="#8ef05a" emissive="#8ef05a" emissiveIntensity={0.5} />
      </mesh>
      <PoiLabel poi="FARM" />
    </group>
  );
}

function Mine() {
  const p = POI.MINE;
  return (
    <group position={[p.x, 0, p.z]}>
      {[
        [-3, 1.6, 1, 2.6],
        [0.5, 2.4, -2, 3.8],
        [3.5, 1.2, 2, 2.2],
      ].map(([x, r, z, h], i) => (
        <mesh key={i} position={[x, h / 2 - 0.2, z]}>
          <coneGeometry args={[r, h, 7]} />
          <meshStandardMaterial color="#26303e" roughness={1} flatShading />
        </mesh>
      ))}
      <pointLight position={[0, 5, 2]} color="#f0b35a" intensity={16} distance={16} />
      {/* crane */}
      <mesh position={[-1, 2.6, 4]}>
        <boxGeometry args={[0.3, 5.2, 0.3]} />
        <meshStandardMaterial color="#f0b35a" emissive="#f0b35a" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.8, 4.9, 4]}>
        <boxGeometry args={[4, 0.25, 0.25]} />
        <meshStandardMaterial color="#f0b35a" emissive="#f0b35a" emissiveIntensity={0.35} />
      </mesh>
      <PoiLabel poi="MINE" />
    </group>
  );
}

function EnergyPlant() {
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!rings.current) return;
    rings.current.children.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 2 + i * 1.3) * 0.5;
    });
  });
  const p = POI.PLANT;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[1.6, 2.2, 4.8, 14]} />
        <meshStandardMaterial color="#0d1f2e" roughness={0.6} />
      </mesh>
      <group ref={rings}>
        {[1.4, 2.6, 3.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.4 - i * 0.25, 0.09, 8, 40]} />
            <meshStandardMaterial color="#2a6ea0" emissive="#5ab6f0" emissiveIntensity={0.9} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 5.6, 0]}>
        <sphereGeometry args={[0.7, 14, 12]} />
        <meshStandardMaterial color="#5ab6f0" emissive="#5ab6f0" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 4, 0]} color="#5ab6f0" intensity={30} distance={18} />
      <PoiLabel poi="PLANT" />
    </group>
  );
}

/* AI agents are fixed protocol buildings; only human citizens get avatars. */
function AgentBuilding({
  citizen,
  selected,
  onSelect,
}: {
  citizen: Citizen;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const beacon = useRef<THREE.Group>(null);
  const pos = useMemo(() => agentBuildingPosition(citizen), [citizen]);
  const roll = rand(citizen.id, 31);
  const color = roll > 0.66 ? "#b085f5" : roll > 0.33 ? "#5ab6f0" : "#3de6c1";
  const height = 2.3 + rand(citizen.id, 44) * 2.1;
  const roof = citizen.occupation === "Engineer" ? "reactor" : citizen.occupation === "Farmer" ? "greenhouse" : citizen.occupation === "Industrialist" ? "foundry" : "signal";

  useFrame(({ clock }) => {
    if (!beacon.current) return;
    beacon.current.rotation.y = clock.elapsedTime * (roof === "reactor" ? 0.55 : 0.22);
    beacon.current.position.y = height + 0.35 + Math.sin(clock.elapsedTime * 2.2 + roll * 6) * 0.08;
  });

  return (
    <group
      position={[pos.x, 0, pos.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      {/* foundation + stepped structural shell: AI agents are places, not NPCs */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[1.82, 2.05, 0.32, 8]} />
        <meshStandardMaterial color="#07131e" roughness={0.85} metalness={0.2} />
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[1.38, 1.62, height, 8]} />
        <meshStandardMaterial color="#102538" emissive={color} emissiveIntensity={hovered || selected ? 0.34 : 0.08} roughness={0.43} metalness={0.28} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.48, height * 0.52, 0]} rotation={[0, 0, side * 0.12]}>
          <boxGeometry args={[0.16, height * 0.88, 2.05]} />
          <meshStandardMaterial color="#1c4053" roughness={0.35} metalness={0.45} />
        </mesh>
      ))}
      {[0.32, 0.52, 0.72].map((level) => (
        <mesh key={level} position={[0, height * level, 1.41]}>
          <boxGeometry args={[1.42, 0.1, 0.08]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered || selected ? 1.65 : 0.7} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, height * 0.62, 1.44]}>
        <planeGeometry args={[1.3, 0.48]} />
        <meshBasicMaterial color="#061019" />
      </mesh>
      <mesh position={[0, height + 0.15, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[1.55, 1.7, 0.28, 8]} />
        <meshStandardMaterial color="#183547" emissive={color} emissiveIntensity={0.42} roughness={0.32} metalness={0.45} />
      </mesh>
      <group ref={beacon}>
        {roof === "greenhouse" ? (
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.56, 1]} />
            <meshStandardMaterial color="#183d2b" emissive="#8ef05a" emissiveIntensity={1.1} roughness={0.22} metalness={0.15} />
          </mesh>
        ) : roof === "foundry" ? (
          <>
            <mesh position={[-0.42, 0.22, 0]}><cylinderGeometry args={[0.18, 0.26, 0.78, 8]} /><meshStandardMaterial color="#263646" /></mesh>
            <mesh position={[0.42, 0.22, 0]}><cylinderGeometry args={[0.18, 0.26, 0.78, 8]} /><meshStandardMaterial color="#263646" /></mesh>
            <mesh position={[0, 0.55, 0]}><sphereGeometry args={[0.26, 12, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} /></mesh>
          </>
        ) : roof === "reactor" ? (
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.62, 0.06, 8, 24]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} /></mesh>
            <mesh><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></mesh>
          </>
        ) : (
          <>
            <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.08, 0.12, 0.8, 6]} /><meshStandardMaterial color="#31556c" metalness={0.5} /></mesh>
            <mesh position={[0, 0.82, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} /></mesh>
          </>
        )}
      </group>
      {(hovered || selected) && <pointLight position={[0, height + 0.4, 0]} color={color} intensity={2.6} distance={6} />}
      {(hovered || selected) && (
        <TextSprite text={`AI BUILDING · ${citizen.name}`} color="#c8fff5" height={0.62} position={[0, height + 1.45, 0]} />
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Businesses                                                          */
/* ------------------------------------------------------------------ */

function BusinessBuilding({
  business,
  selected,
  onSelect,
}: {
  business: Business;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => businessPosition(business), [business]);
  const color =
    business.businessType === 0 ? "#8ef05a" : business.businessType === 1 ? "#f0b35a" : "#5ab6f0";
  const h = 1.6 + (business.employees % 5) * 0.35;

  return (
    <group
      position={[pos.x, 0, pos.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[2, h, 2]} />
        <meshStandardMaterial
          color="#0d1c2b"
          emissive={color}
          emissiveIntensity={hovered || selected ? 0.5 : 0.12}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, h + 0.1, 0]}>
        <boxGeometry args={[2.2, 0.14, 2.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      {(hovered || selected) && (
        <TextSprite
          text={`🏭 ${business.name}`}
          color={color}
          height={0.7}
          position={[0, h + 1.2, 0]}
        />
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Filler skyline (instanced)                                          */
/* ------------------------------------------------------------------ */

function FillerCity() {
  const towers = useMemo(() => fillerBuildings(90), []);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const windowRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    towers.forEach((t, i) => {
      m.makeScale(t.w, t.h, t.w);
      m.setPosition(t.x, t.h / 2, t.z);
      bodyRef.current?.setMatrixAt(i, m);
      m.makeScale(t.w * 1.05, 0.08, t.w * 1.05);
      m.setPosition(t.x, t.h + 0.04, t.z);
      capRef.current?.setMatrixAt(i, m);
      color.set(t.seed % 3 === 0 ? "#f0b35a" : "#3de6c1");
      capRef.current?.setColorAt(i, color);

      // A facade light ribbon breaks the repeated-box silhouette without
      // adding per-tower draw calls.
      m.makeScale(t.w * 0.64, Math.max(0.34, t.h * 0.42), 0.035);
      m.setPosition(t.x, t.h * 0.58, t.z + t.w * 0.51);
      windowRef.current?.setMatrixAt(i * 2, m);
      m.makeScale(0.035, Math.max(0.34, t.h * 0.42), t.w * 0.64);
      m.setPosition(t.x + t.w * 0.51, t.h * 0.58, t.z);
      windowRef.current?.setMatrixAt(i * 2 + 1, m);
      windowRef.current?.setColorAt(i * 2, color);
      windowRef.current?.setColorAt(i * 2 + 1, color);
    });
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true;
    if (capRef.current) {
      capRef.current.instanceMatrix.needsUpdate = true;
      if (capRef.current.instanceColor) capRef.current.instanceColor.needsUpdate = true;
    }
    if (windowRef.current) {
      windowRef.current.instanceMatrix.needsUpdate = true;
      if (windowRef.current.instanceColor) windowRef.current.instanceColor.needsUpdate = true;
    }
  }, [towers]);

  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#122334" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" emissive="#9efce9" emissiveIntensity={0.6} />
      </instancedMesh>
      <instancedMesh ref={windowRef} args={[undefined, undefined, towers.length * 2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" emissive="#7fd9cd" emissiveIntensity={0.38} roughness={0.3} />
      </instancedMesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Roads from market to each POI                                       */
/* ------------------------------------------------------------------ */

function Roads() {
  const roads = useMemo(() => {
    return (Object.keys(POI) as PoiKey[])
      .filter((k) => k !== "MARKET")
      .map((k) => {
        const p = POI[k];
        const len = Math.hypot(p.x, p.z);
        const angle = Math.atan2(p.x, p.z);
        return { key: k, x: p.x / 2, z: p.z / 2, len, angle };
      });
  }, []);
  return (
    <>
      {roads.map((r) => (
        <mesh key={r.key} position={[r.x, 0.02, r.z]} rotation={[-Math.PI / 2, 0, -r.angle]}>
          <planeGeometry args={[1.6, r.len]} />
          <meshStandardMaterial
            color="#0a1c2a"
            emissive="#3de6c1"
            emissiveIntensity={0.08}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig: eases the orbit target toward the selection             */
/* ------------------------------------------------------------------ */

function Player({ player, onNearby, touchDir }: { player: PlayerState; onNearby: (poi: PoiKey | null) => void; touchDir: React.RefObject<{ x: number; z: number }> }) {
  const group = useRef<THREE.Group>(null);
  const visor = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const lastNearby = useRef<PoiKey | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => { keys.current.clear(); touchDir.current.x = 0; touchDir.current.z = 0; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, [touchDir]);

  useFrame(({ clock }, dt) => {
    const x = (keys.current.has("d") ? 1 : 0) - (keys.current.has("a") ? 1 : 0) + touchDir.current.x;
    const z = (keys.current.has("s") ? 1 : 0) - (keys.current.has("w") ? 1 : 0) + touchDir.current.z;
    const length = Math.hypot(x, z);
    if (length > 0.05) {
      const speed = 7.2 * dt;
      player.pos.x = THREE.MathUtils.clamp(player.pos.x + (x / length) * speed, -54, 54);
      player.pos.z = THREE.MathUtils.clamp(player.pos.z + (z / length) * speed, -54, 54);
      player.yaw = Math.atan2(x, z);
    }
    const g = group.current;
    if (g) {
      g.position.set(player.pos.x, 0.05 + Math.sin(clock.elapsedTime * 4) * 0.035, player.pos.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, player.yaw, dt * 9);
    }
    if (visor.current) {
      (visor.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.2 + Math.sin(clock.elapsedTime * 4) * 0.35;
    }
    const cameraTarget = new THREE.Vector3(player.pos.x, 1.5, player.pos.z);
    const cameraPos = new THREE.Vector3(player.pos.x + 8, 7.5, player.pos.z + 10);
    camera.position.lerp(cameraPos, Math.min(1, dt * 4.5));
    camera.lookAt(cameraTarget);
    let nearest: PoiKey | null = null;
    let distance = 999;
    (Object.keys(POI) as PoiKey[]).forEach((key) => {
      const p = POI[key];
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      if (d < distance) { distance = d; nearest = key; }
    });
    const next = distance < 7 ? nearest : null;
    if (next !== lastNearby.current) { lastNearby.current = next; onNearby(next); }
  });

  return (
    <group ref={group}>
      {/* A readable third-person explorer: suit, visor, backpack, and tool beacon. */}
      <mesh position={[0, 0.64, 0]} castShadow>
        <capsuleGeometry args={[0.36, 0.78, 5, 12]} />
        <meshStandardMaterial color="#19354b" emissive="#16495a" emissiveIntensity={0.35} roughness={0.32} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.29, 16, 12]} />
        <meshStandardMaterial color="#0a1722" roughness={0.2} metalness={0.55} />
      </mesh>
      <mesh ref={visor} position={[0, 1.44, 0.235]}>
        <sphereGeometry args={[0.205, 16, 10, 0, Math.PI]} />
        <meshStandardMaterial color="#071e27" emissive="#7affdf" emissiveIntensity={1.2} roughness={0.12} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.82, -0.34]}>
        <boxGeometry args={[0.42, 0.54, 0.2]} />
        <meshStandardMaterial color="#102636" emissive="#3de6c1" emissiveIntensity={0.28} roughness={0.4} metalness={0.4} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.43, 0.86, 0]} rotation={[0, 0, side * 0.2]}>
          <mesh>
            <capsuleGeometry args={[0.1, 0.38, 4, 8]} />
            <meshStandardMaterial color="#22455d" roughness={0.45} metalness={0.15} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52, 28]} />
        <meshBasicMaterial color="#07131e" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.62, 32]} />
        <meshBasicMaterial color="#60f5d2" transparent opacity={0.8} />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color="#3de6c1" intensity={2.5} distance={5} />
      <TextSprite text="YOU" color="#d4fff7" height={0.55} position={[0, 2.1, 0]} />
    </group>
  );
}

function SceneSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.08;
    const globalWindow = window as typeof window & {
      __THREE_GAME_DIAGNOSTICS__?: { renderer: THREE.WebGLInfo; world: { dpr: number; postPasses: number } };
    };
    globalWindow.__THREE_GAME_DIAGNOSTICS__ = {
      renderer: gl.info,
      world: { dpr: gl.getPixelRatio(), postPasses: 0 },
    };
    return () => {
      delete globalWindow.__THREE_GAME_DIAGNOSTICS__;
    };
  }, [gl]);
  return null;
}

function DirectionKey({
  label,
  x,
  z,
  touchDir,
}: {
  label: string;
  x: number;
  z: number;
  touchDir: React.RefObject<{ x: number; z: number }>;
}) {
  const press = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDir.current.x = x;
    touchDir.current.z = z;
  };
  const release = () => {
    touchDir.current.x = 0;
    touchDir.current.z = 0;
  };
  return (
    <button
      className="touch-key"
      aria-label={`Move ${label}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function WorldScene({
  citizens,
  businesses,
  events,
  selection,
  onSelect,
}: {
  citizens: Citizen[];
  businesses: Business[];
  events: CivilizationEvent[];
  selection: WorldSelection;
  onSelect: (s: WorldSelection) => void;
}) {
  const router = useRouter();
  const simMap = useRef(new Map<string, AgentSim>());
  const player = useRef<PlayerState>({ pos: new THREE.Vector3(0, 0, 8), yaw: 0, nearby: null });
  const [nearby, setNearby] = useState<PoiKey | null>(null);
  const [toast, setToast] = useState("Explore the city. Every building is a live protocol.");
  const touchDir = useRef({ x: 0, z: 0 });

  const interact = () => {
    if (!nearby) return;
    const messages: Record<PoiKey, string> = {
      MARKET: "Opening the market terminal — buy or sell resources with your connected wallet.",
      GOVERNMENT: "Opening the governance chamber — review the live civic proposal.",
      FARM: "Agri district scanned — select an AI building to inspect or hire its operator.",
      MINE: "Industrial district scanned — select an AI building to inspect or hire its operator.",
      PLANT: "Energy district scanned — select an AI building to inspect or hire its operator.",
    };
    setToast(messages[nearby]);
    if (nearby === "MARKET") router.push("/market");
    if (nearby === "GOVERNMENT") router.push("/governance");
    if (nearby === "FARM" || nearby === "MINE" || nearby === "PLANT") router.push("/citizens");
  };

  const actionLabel = nearby === "MARKET"
    ? "OPEN MARKET"
    : nearby === "GOVERNMENT"
      ? "OPEN GOVERNANCE"
      : "FIND AGENTS";

  return (
    <div className="relative h-full w-full">
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [26, 24, 34], fov: 45, near: 0.5, far: 260 }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SceneSetup />
      <color attach="background" args={["#03070c"]} />
      <fog attach="fog" args={["#03070c", 55, 150]} />

      <ambientLight intensity={0.5} color="#8fd8ff" />
      <directionalLight position={[30, 42, 18]} intensity={1.4} color="#cfeaff" />
      <hemisphereLight args={["#1d4260", "#0a1018", 0.9]} />

      <Stars radius={140} depth={40} count={1800} factor={3.4} saturation={0} fade speed={0.6} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[85, 64]} />
        <meshStandardMaterial color="#04090f" roughness={1} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[170, 170]}
        cellSize={3.5}
        cellThickness={0.4}
        cellColor="#0d2b33"
        sectionSize={17.5}
        sectionThickness={0.8}
        sectionColor="#134d47"
        fadeDistance={110}
        fadeStrength={2}
        infiniteGrid={false}
      />

      <Roads />
      <MarketPlaza />
      <Government />
      <Farm />
      <Mine />
      <EnergyPlant />
      <FillerCity />

      {businesses.map((b) => (
        <BusinessBuilding
          key={b.id}
          business={b}
          selected={selection?.kind === "business" && selection.id === b.id}
          onSelect={() => onSelect({ kind: "business", id: b.id })}
        />
      ))}

      <Citizens
        citizens={citizens}
        events={events}
        selection={selection}
        onSelect={onSelect}
        simMap={simMap.current}
      />
      <Player player={player.current} touchDir={touchDir} onNearby={(key) => { setNearby(key); player.current.nearby = key; }} />
    </Canvas>
    <div className="world-controls pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 sm:p-6">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-cyan-300/20 bg-[#06111c]/80 p-3 text-xs text-slate-300 shadow-2xl backdrop-blur-xl">
        <p className="mb-1 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.25em] text-cyan-300">CITY LINK</p>
        <p>{toast}</p>
        <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">WASD to move · touch controls on mobile · approach a district to connect</p>
      </div>
      <div className="pointer-events-auto hidden items-end gap-3 sm:flex">
        <div className="grid grid-cols-3 gap-1 text-center text-xs text-cyan-100">
          <span /> <DirectionKey label="W" x={0} z={-1} touchDir={touchDir} /> <span />
          <DirectionKey label="A" x={-1} z={0} touchDir={touchDir} />
          <DirectionKey label="S" x={0} z={1} touchDir={touchDir} />
          <DirectionKey label="D" x={1} z={0} touchDir={touchDir} />
        </div>
        {nearby && <button className="btn-primary !px-4 !py-3 text-xs" onClick={interact}>{actionLabel} · {POI_LABELS[nearby]}</button>}
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2 sm:hidden">
        {nearby && <button className="btn-primary !px-3 !py-2 text-xs" onClick={interact}>{actionLabel}</button>}
        <div className="grid grid-cols-3 gap-1 text-center text-xs text-cyan-100">
          <span /> <DirectionKey label="▲" x={0} z={-1} touchDir={touchDir} /> <span />
          <DirectionKey label="◀" x={-1} z={0} touchDir={touchDir} />
          <DirectionKey label="▼" x={0} z={1} touchDir={touchDir} />
          <DirectionKey label="▶" x={1} z={0} touchDir={touchDir} />
        </div>
      </div>
    </div>
    </div>
  );
}
