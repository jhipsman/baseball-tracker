"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Figure } from "@/lib/figures/library";
import { joints, place } from "@/lib/figures/skeleton";

const MOVE = 1100;
const HOLD = 450;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function poseAt(fig: Figure, ms: number) {
  const path = [...fig.frames.keys(), ...[...fig.frames.keys()].reverse().slice(1, -1)];
  const leg = MOVE + HOLD;
  const t = ((Math.max(0, ms) % (leg * path.length)) + leg * path.length) % (leg * path.length);
  const i = Math.floor(t / leg);
  const local = t % leg;
  if (fig.frames.length === 1 || local < HOLD) return fig.frames[path[i]];
  const a = fig.frames[path[i]];
  const b = fig.frames[path[(i + 1) % path.length]];
  const mix = (x: number, y: number) => x + (y - x) * ease((local - HOLD) / MOVE);
  return {
    torso: mix(a.torso, b.torso),
    arm: a.arm.map((limb, n) => limb.map((v, k) => mix(v, b.arm[n][k]))) as typeof a.arm,
    leg: a.leg.map((limb, n) => limb.map((v, k) => mix(v, b.leg[n][k]))) as typeof a.leg,
    foot: [
      mix(a.foot?.[0] ?? 90, b.foot?.[0] ?? 90),
      mix(a.foot?.[1] ?? 90, b.foot?.[1] ?? 90),
    ] as [number, number],
    head: mix(a.head ?? 0, b.head ?? 0),
    reach: [
      mix(a.reach?.[0] ?? 1, b.reach?.[0] ?? 1),
      mix(a.reach?.[1] ?? 1, b.reach?.[1] ?? 1),
    ] as [number, number],
  };
}

/** A small, shaded WebGL mannequin driven by the same poses as the 2D demos. */
export function ExerciseFigure3D({ fig, name }: { fig: Figure; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const tokenColor = (name: string) =>
      new THREE.Color().setStyle(getComputedStyle(canvas).getPropertyValue(name).trim() || "white");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(1.8, 0.55, 6.5);
    camera.lookAt(0, 0.1, 0);
    scene.add(
      new THREE.HemisphereLight(
        tokenColor("--color-zinc-100"),
        tokenColor("--color-zinc-700"),
        2.1,
      ),
    );
    const key = new THREE.DirectionalLight(tokenColor("--color-zinc-900"), 3);
    key.position.set(-3, 5, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(tokenColor("--color-brand-400"), 1.1);
    fill.position.set(3, 1, -3);
    scene.add(fill);

    const group = new THREE.Group();
    scene.add(group);
    const skin = new THREE.MeshStandardMaterial({
      color: tokenColor("--color-amber-600"),
      roughness: 0.62,
      metalness: 0.02,
    });
    const jersey = new THREE.MeshStandardMaterial({
      color: tokenColor("--color-brand-700"),
      roughness: 0.55,
    });
    const shorts = new THREE.MeshStandardMaterial({
      color: tokenColor("--color-zinc-800"),
      roughness: 0.68,
    });
    const shoe = new THREE.MeshStandardMaterial({
      color: tokenColor("--color-zinc-100"),
      roughness: 0.4,
    });
    const ball = new THREE.MeshStandardMaterial({
      color: tokenColor("--color-zinc-100"),
      roughness: 0.4,
    });
    const sphere = new THREE.SphereGeometry(1, 20, 16);
    const parts: Record<string, THREE.Mesh> = {};
    const addSphere = (id: string, material: THREE.Material, scale: [number, number, number]) => {
      const mesh = new THREE.Mesh(sphere, material);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      group.add(mesh);
      parts[id] = mesh;
    };
    const addLimb = (id: string, material: THREE.Material, radius: number) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 1, 4, 10), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      parts[id] = mesh;
    };
    addSphere("head", skin, [0.17, 0.2, 0.16]);
    addSphere("torso", jersey, [0.29, 0.44, 0.18]);
    addSphere("pelvis", shorts, [0.3, 0.19, 0.19]);
    for (const side of [0, 1]) {
      const suffix = `${side}`;
      addLimb(`upperArm${suffix}`, jersey, 0.09);
      addLimb(`forearm${suffix}`, skin, 0.07);
      addLimb(`thigh${suffix}`, shorts, 0.12);
      addLimb(`shin${suffix}`, skin, 0.075);
      addSphere(`hand${suffix}`, skin, [0.08, 0.08, 0.08]);
      addSphere(`shoe${suffix}`, shoe, [0.16, 0.08, 0.1]);
    }
    if (fig.props?.some((prop) => prop.kind === "ball" || prop.kind === "medball")) {
      addSphere("exerciseBall", ball, [0.14, 0.14, 0.14]);
    }
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 48),
      new THREE.MeshBasicMaterial({
        color: tokenColor("--color-zinc-500"),
        transparent: true,
        opacity: 0.14,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.65;
    floor.scale.set(1.2, 0.36, 1);
    scene.add(floor);

    const point = (p: [number, number], depth: number): THREE.Vector3 =>
      new THREE.Vector3((p[0] - 60) * 0.045, (45 - p[1]) * 0.045, depth);
    const setLimb = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      const delta = new THREE.Vector3().subVectors(b, a);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
      mesh.scale.y = Math.max(0.2, delta.length() - 0.14);
    };

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const pose = poseAt(fig, now - start);
      const j = place(joints(pose, fig.view), fig.anchor);
      const near = (p: [number, number]) => point(p, 0.14);
      const far = (p: [number, number]) => point(p, -0.14);
      const hipNear = near(j.hips[0]),
        hipFar = far(j.hips[1]);
      const shoulderNear = near(j.shoulders[0]),
        shoulderFar = far(j.shoulders[1]);
      parts.head.position.copy(point(j.head, 0));
      parts.torso.position.copy(point(j.hip, 0).add(point(j.neck, 0)).multiplyScalar(0.5));
      parts.torso.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        point(j.neck, 0).sub(point(j.hip, 0)).normalize(),
      );
      parts.pelvis.position.copy(point(j.hip, 0));
      for (const [i, z] of [
        [0, 0.14],
        [1, -0.14],
      ] as const) {
        const side = `${i}`;
        const shoulder = i === 0 ? shoulderNear : shoulderFar;
        const hip = i === 0 ? hipNear : hipFar;
        const elbow = i === 0 ? near(j.elbow[i]) : far(j.elbow[i]);
        const hand = i === 0 ? near(j.hand[i]) : far(j.hand[i]);
        const knee = i === 0 ? near(j.knee[i]) : far(j.knee[i]);
        const ankle = i === 0 ? near(j.ankle[i]) : far(j.ankle[i]);
        setLimb(parts[`upperArm${side}`], shoulder, elbow);
        setLimb(parts[`forearm${side}`], elbow, hand);
        setLimb(parts[`thigh${side}`], hip, knee);
        setLimb(parts[`shin${side}`], knee, ankle);
        parts[`hand${side}`].position.copy(hand);
        const toe = i === 0 ? j.toe[0] : j.toe[1];
        parts[`shoe${side}`].position.copy(point(toe, z));
        parts[`shoe${side}`].rotation.z = -((pose.foot?.[i] ?? 90) * Math.PI) / 180;
      }
      if (parts.exerciseBall) parts.exerciseBall.position.copy(point(j.hand[0], 0.2));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const material of [skin, jersey, shorts, shoe, ball]) material.dispose();
      renderer.dispose();
    };
  }, [fig]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      role="img"
      aria-label={`3D animation demonstrating ${name}`}
    />
  );
}
