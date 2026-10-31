"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** A captured, pre-rigged exercise motion, loaded only when the demo is opened. */
export function WorkoutModel({ src, name }: { src: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(200, 130, 260);
    camera.lookAt(0, 90, 0);
    scene.add(new THREE.HemisphereLight("white", "dimgray", 2));
    const light = new THREE.DirectionalLight("white", 2);
    light.position.set(100, 300, 200);
    scene.add(light);
    let mixer: THREE.AnimationMixer | undefined;
    let model: THREE.Object3D | undefined;
    const weights: {
      group: THREE.Group;
      index: THREE.Object3D;
      little: THREE.Object3D;
      palm: THREE.Object3D;
    }[] = [];
    let raf = 0;
    let disposed = false;
    let previous = 0;
    const disposeModel = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
    new GLTFLoader().load(
      src,
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }
        if (!gltf.animations.length) {
          disposeModel(gltf.scene);
          setFailed(true);
          return;
        }
        model = gltf.scene;
        scene.add(model);
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        for (const side of ["Left", "Right"]) {
          const index = model.getObjectByName(`${side}Finger2Proximal`);
          const little = model.getObjectByName(`${side}Finger5Proximal`);
          const palm = model.getObjectByName(`${side}Finger3Proximal`);
          if (!index || !little || !palm) continue;
          const group = new THREE.Group();
          const material = new THREE.MeshStandardMaterial({
            color: "slategray",
            roughness: 0.48,
            metalness: 0.35,
          });
          const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 20, 12), material);
          group.add(handle);
          for (const offset of [-9, 9]) {
            const plate = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 4, 16), material);
            plate.position.y = offset;
            group.add(plate);
          }
          scene.add(group);
          weights.push({ group, index, little, palm });
        }
      },
      undefined,
      () => {
        if (!disposed) setFailed(true);
      },
    );
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
    const tick = (time: number) => {
      if (previous) mixer?.update(Math.min((time - previous) / 1000, 0.1));
      previous = time;
      model?.updateMatrixWorld(true);
      for (const weight of weights) {
        const index = weight.index.getWorldPosition(new THREE.Vector3());
        const little = weight.little.getWorldPosition(new THREE.Vector3());
        weight.palm.getWorldPosition(weight.group.position);
        const direction = little.sub(index).normalize();
        if (direction.lengthSq())
          weight.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (model) {
        mixer?.stopAllAction();
        disposeModel(model);
      }
      weights.forEach(({ group }) => disposeModel(group));
      renderer.dispose();
    };
  }, [src]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        role="img"
        aria-label={`3D motion capture of ${name}`}
      />
      {failed ? (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-zinc-600">
          3D demonstration unavailable on this device.
        </p>
      ) : null}
    </div>
  );
}
