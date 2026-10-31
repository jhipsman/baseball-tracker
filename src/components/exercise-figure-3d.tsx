"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Figure } from "@/lib/figures/library";
import { joints, mixPose, place, type Point, type Pose } from "@/lib/figures/skeleton";

const MOVE = 1100;
const HOLD = 450;
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function poseAt(fig: Figure, ms: number): Pose {
  const path = [...fig.frames.keys(), ...[...fig.frames.keys()].reverse().slice(1, -1)];
  const leg = MOVE + HOLD;
  const total = leg * path.length;
  const t = ((Math.max(0, ms) % total) + total) % total;
  const index = Math.floor(t / leg);
  const local = t % leg;
  if (fig.frames.length === 1 || local < HOLD) return fig.frames[path[index]];
  return mixPose(
    fig.frames[path[index]],
    fig.frames[path[(index + 1) % path.length]],
    ease((local - HOLD) / MOVE),
  );
}

type RigSegment = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  targetStart: THREE.Vector3;
  targetEnd: THREE.Vector3;
  rotation: THREE.Quaternion;
};

type DeformData = {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  original: Float32Array;
  next: Float32Array;
  segmentA: Uint8Array;
  segmentB: Uint8Array;
  amountA: Float32Array;
  alongA: Float32Array;
  alongB: Float32Array;
  offsetA: Float32Array;
  offsetB: Float32Array;
};

const distanceToSegment = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a);
  const lengthSq = ab.lengthSq();
  const t = lengthSq ? THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / lengthSq, 0, 1) : 0;
  return { distance: p.distanceTo(a.clone().addScaledVector(ab, t)), t };
};

/**
 * Load the CC0 low-poly athlete and bend its actual mesh around the same joints
 * as the exercise diagrams. This keeps a proper, textured character without
 * shipping a collection of heavy, per-exercise models.
 */
export function ExerciseFigure3D({ fig, name }: { fig: Figure; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const cssColor = (property: string) =>
      new THREE.Color().setStyle(
        getComputedStyle(canvas).getPropertyValue(property).trim() || "white",
      );
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.1, 30);
    camera.position.set(fig.view === "side" ? 2.5 : 0.55, 1.1, 6.5);
    camera.lookAt(0, 0.92, 0);
    scene.add(
      new THREE.HemisphereLight(cssColor("--color-zinc-100"), cssColor("--color-zinc-700"), 2.2),
    );
    const key = new THREE.DirectionalLight(cssColor("--color-zinc-900"), 2.8);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(cssColor("--color-brand-400"), 1.15);
    rim.position.set(3, 2, -3);
    scene.add(rim);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.y = fig.view === "side" ? Math.PI / 2 : 0;
    scene.add(modelRoot);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 48),
      new THREE.MeshBasicMaterial({
        color: cssColor("--color-zinc-500"),
        transparent: true,
        opacity: 0.16,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    shadow.scale.set(1.35, 0.42, 1);
    scene.add(shadow);

    const restPoint = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
    const hip = restPoint(0, 0.91);
    const neck = restPoint(0, 1.48);
    const head = restPoint(0, 1.72);
    const segments: RigSegment[] = [
      {
        start: hip,
        end: neck,
        targetStart: hip.clone(),
        targetEnd: neck.clone(),
        rotation: new THREE.Quaternion(),
      },
      {
        start: neck,
        end: head,
        targetStart: neck.clone(),
        targetEnd: head.clone(),
        rotation: new THREE.Quaternion(),
      },
    ];
    for (const side of [0, 1] as const) {
      const sign = side === 0 ? -1 : 1;
      const shoulder = restPoint(sign * 0.23, 1.36);
      const elbow = restPoint(sign * 0.46, 1.19);
      const hand = restPoint(sign * 0.65, 1.04);
      const legHip = restPoint(sign * 0.105, 0.9);
      const knee = restPoint(sign * 0.12, 0.51);
      const ankle = restPoint(sign * 0.1, 0.09);
      const toe = restPoint(sign * 0.16, 0.035, 0.1);
      for (const [start, end] of [
        [shoulder, elbow],
        [elbow, hand],
        [legHip, knee],
        [knee, ankle],
        [ankle, toe],
      ]) {
        segments.push({
          start,
          end,
          targetStart: start.clone(),
          targetEnd: end.clone(),
          rotation: new THREE.Quaternion(),
        });
      }
    }

    let raf = 0;
    let cancelled = false;
    let loaded: THREE.Group | null = null;
    const deformers: DeformData[] = [];
    const loader = new GLTFLoader();
    const startedAt = performance.now();

    const prepareMesh = (source: THREE.Mesh, centerX: number, centerZ: number) => {
      const geometry = source.geometry.clone();
      geometry.applyMatrix4(source.matrixWorld);
      const position = geometry.getAttribute("position") as THREE.BufferAttribute;
      const original = new Float32Array(position.array as ArrayLike<number>);
      for (let i = 0; i < original.length; i += 3) {
        original[i] -= centerX;
        original[i + 2] -= centerZ;
      }

      const count = position.count;
      const segmentA = new Uint8Array(count);
      const segmentB = new Uint8Array(count);
      const amountA = new Float32Array(count);
      const alongA = new Float32Array(count);
      const alongB = new Float32Array(count);
      const offsetA = new Float32Array(count * 3);
      const offsetB = new Float32Array(count * 3);
      const vertex = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        vertex.fromArray(original, i * 3);
        let best = Infinity;
        let second = Infinity;
        let a = 0;
        let b = 0;
        let ta = 0;
        let tb = 0;
        for (let s = 0; s < segments.length; s++) {
          const closest = distanceToSegment(vertex, segments[s].start, segments[s].end);
          if (closest.distance < best) {
            second = best;
            b = a;
            tb = ta;
            best = closest.distance;
            a = s;
            ta = closest.t;
          } else if (closest.distance < second) {
            second = closest.distance;
            b = s;
            tb = closest.t;
          }
        }
        segmentA[i] = a;
        segmentB[i] = b;
        amountA[i] = second > best + 0.1 ? 1 : second / Math.max(0.001, best + second);
        alongA[i] = ta;
        alongB[i] = tb;

        for (const [segmentIndex, along, output] of [
          [a, ta, offsetA],
          [b, tb, offsetB],
        ] as const) {
          const segment = segments[segmentIndex];
          const direction = segment.end.clone().sub(segment.start);
          const point = segment.start.clone().addScaledVector(direction, along);
          const restRotation = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
          const offset = vertex.sub(point).applyQuaternion(restRotation.invert());
          output[i * 3] = offset.x;
          output[i * 3 + 1] = offset.y;
          output[i * 3 + 2] = offset.z;
        }
      }

      const dynamic = geometry.clone();
      dynamic.setAttribute("position", new THREE.BufferAttribute(new Float32Array(original), 3));
      dynamic.computeVertexNormals();
      const mesh = new THREE.Mesh(dynamic, source.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      modelRoot.add(mesh);
      deformers.push({
        mesh,
        geometry: dynamic,
        original,
        next: new Float32Array(original.length),
        segmentA,
        segmentB,
        amountA,
        alongA,
        alongB,
        offsetA,
        offsetB,
      });
      geometry.dispose();
    };

    const render = (now: number) => {
      const pose = poseAt(fig, now - startedAt);
      const j = place(joints(pose, fig.view), fig.anchor);
      const toModel = (p: Point, side: 0 | 1): THREE.Vector3 => {
        const forward = (p[0] - 60) * 0.0195;
        const y = (90 - p[1]) * 0.028;
        const depth = side === 0 ? 0.13 : -0.13;
        return fig.view === "side"
          ? new THREE.Vector3(depth, y, forward)
          : new THREE.Vector3(forward, y, depth);
      };
      const centerPoint = (p: Point) => {
        const forward = (p[0] - 60) * 0.0195;
        return fig.view === "side"
          ? new THREE.Vector3(0, (90 - p[1]) * 0.028, forward)
          : new THREE.Vector3(forward, (90 - p[1]) * 0.028, 0);
      };
      const targetPairs: Array<[Point, Point]> = [
        [j.hip, j.neck],
        [j.neck, j.head],
      ];
      for (const side of [0, 1] as const) {
        targetPairs.push(
          [j.shoulders[side], j.elbow[side]],
          [j.elbow[side], j.hand[side]],
          [j.hips[side], j.knee[side]],
          [j.knee[side], j.ankle[side]],
          [j.ankle[side], j.toe[side]],
        );
      }
      for (let s = 0; s < segments.length; s++) {
        const side = s < 2 ? 0 : (Math.floor((s - 2) / 5) as 0 | 1);
        const [a, b] = targetPairs[s];
        segments[s].targetStart = s < 2 ? centerPoint(a) : toModel(a, side as 0 | 1);
        segments[s].targetEnd = s < 2 ? centerPoint(b) : toModel(b, side as 0 | 1);
        segments[s].rotation.setFromUnitVectors(
          UP,
          segments[s].targetEnd.clone().sub(segments[s].targetStart).normalize(),
        );
      }

      const offset = new THREE.Vector3();
      const position = new THREE.Vector3();
      const otherPosition = new THREE.Vector3();
      for (const item of deformers) {
        for (let i = 0; i < item.segmentA.length; i++) {
          const a = segments[item.segmentA[i]];
          const b = segments[item.segmentB[i]];
          const w = item.amountA[i];
          const ta = item.alongA[i];
          const tb = item.alongB[i];
          offset
            .set(item.offsetA[i * 3], item.offsetA[i * 3 + 1], item.offsetA[i * 3 + 2])
            .applyQuaternion(a.rotation);
          position.copy(a.targetStart).lerp(a.targetEnd, ta).addScaledVector(offset, w);
          offset
            .set(item.offsetB[i * 3], item.offsetB[i * 3 + 1], item.offsetB[i * 3 + 2])
            .applyQuaternion(b.rotation);
          otherPosition.copy(b.targetStart).lerp(b.targetEnd, tb).add(offset);
          position.addScaledVector(otherPosition, 1 - w);
          item.next[i * 3] = position.x;
          item.next[i * 3 + 1] = position.y;
          item.next[i * 3 + 2] = position.z;
        }
        const attribute = item.geometry.getAttribute("position") as THREE.BufferAttribute;
        attribute.array.set(item.next);
        attribute.needsUpdate = true;
        item.geometry.computeVertexNormals();
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    loader.load("/models/fitness-character.glb", (gltf) => {
      if (cancelled) {
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
        });
        return;
      }
      loaded = gltf.scene;
      loaded.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(loaded);
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      loaded.traverse((object) => {
        if (object instanceof THREE.Mesh) prepareMesh(object, centerX, centerZ);
      });
      render(performance.now());
    });

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const viewHeight = 2.35;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const item of deformers) item.geometry.dispose();
      if (loaded) {
        loaded.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
      }
      shadow.geometry.dispose();
      shadow.material.dispose();
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
