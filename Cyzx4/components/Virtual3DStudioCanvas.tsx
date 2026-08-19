import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AngleSpec, LUT_PRESETS } from '../services/anglePromptService';
import { Camera, Focus, RotateCcw, Sparkles, User, ZoomIn } from 'lucide-react';

interface Virtual3DStudioCanvasProps {
  spec: AngleSpec;
  onChangeSpec: (updater: (prev: AngleSpec) => AngleSpec) => void;
  snapEnabled?: boolean;
}

const SNAP_ANGLES = [0, 45, 90, 135, 180, -135, -90, -45];
const SNAP_THRESHOLD = 5.0;

// Convert 35mm focal length (mm) to Vertical Camera FOV degrees
const focalLengthToFov = (focalMm: number): number => {
  const sensorHeight = 24; // 35mm full frame sensor height
  const rad = 2 * Math.atan(sensorHeight / (2 * (focalMm || 50)));
  return Math.round(rad * (180 / Math.PI));
};

export const Virtual3DStudioCanvas: React.FC<Virtual3DStudioCanvasProps> = ({
  spec,
  onChangeSpec,
  snapEnabled = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'camera' | 'model'>('camera');
  const [isSnapped, setIsSnapped] = useState(false);
  const [snappedAngleName, setSnappedAngleName] = useState<string>('');
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Live Camera Viewfinder Draggable Position State (PRD Feature)
  const [vfPos, setVfPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingVf = useRef(false);
  const vfDragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleVfMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const currentX = vfPos ? vfPos.x : containerRect.width - 235;
    const currentY = vfPos ? vfPos.y : containerRect.height - 185;

    isDraggingVf.current = true;
    vfDragOffset.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingVf.current || !containerRef.current) return;
      const newX = e.clientX - vfDragOffset.current.x;
      const newY = e.clientY - vfDragOffset.current.y;
      setVfPos({ x: newX, y: newY });
    };

    const handleGlobalMouseUp = () => {
      isDraggingVf.current = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Three.js Scene References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const mainCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const viewfinderCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mainRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const viewfinderRendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const mannequinGroupRef = useRef<THREE.Group | null>(null);
  const headMeshRef = useRef<THREE.Mesh | null>(null);
  const cameraMeshRef = useRef<THREE.Group | null>(null);
  const sightLineRef = useRef<THREE.Line | null>(null);

  // Initialize Dual-Camera Three.js WebGL Scene (Main Studio + Viewfinder PIP)
  useEffect(() => {
    if (!containerRef.current || !viewfinderRef.current) return;
    const w = containerRef.current.clientWidth || 650;
    const h = containerRef.current.clientHeight || 450;

    // 1. Light Studio Scene Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.05);
    sceneRef.current = scene;

    // 2. Main Studio Overview Camera (Balanced, elegant studio full view)
    const mainCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    mainCamera.position.set(3.6, 2.4, 4.4);
    mainCamera.lookAt(0, 0.95, 0);
    mainCameraRef.current = mainCamera;

    // 3. Viewfinder Camera (Point of View facing Mannequin)
    const initialFov = focalLengthToFov(spec.camera.focalLength || 50);
    const vfCamera = new THREE.PerspectiveCamera(initialFov, 1.4, 0.1, 50);
    viewfinderCameraRef.current = vfCamera;

    // 4. Main WebGL Renderer
    const mainRenderer = new THREE.WebGLRenderer({ antialias: true });
    mainRenderer.setSize(w, h);
    mainRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mainRenderer.shadowMap.enabled = true;
    mainRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(mainRenderer.domElement);
    mainRendererRef.current = mainRenderer;

    // 5. Viewfinder Inset Renderer
    const vfW = 210;
    const vfH = 150;
    const vfRenderer = new THREE.WebGLRenderer({ antialias: true });
    vfRenderer.setSize(vfW, vfH);
    vfRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    vfRenderer.shadowMap.enabled = true;

    viewfinderRef.current.innerHTML = '';
    viewfinderRef.current.appendChild(vfRenderer.domElement);
    viewfinderRendererRef.current = vfRenderer;

    // 6. Studio Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.6);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.9);
    fillLight.position.set(-4, 4, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.7);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    // 7. Light Studio Floor Grid & Orbit Ring
    const gridHelper = new THREE.GridHelper(10, 20, 0xed6d46, 0xcbd5e1);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Orbit Ring
    const orbitRingGeo = new THREE.RingGeometry(3.18, 3.22, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0xed6d46,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2;
    orbitRing.position.y = 0.005;
    scene.add(orbitRing);

    // 8. Matte Grey Mannequin Model
    const mannequinGroup = new THREE.Group();
    scene.add(mannequinGroup);
    mannequinGroupRef.current = mannequinGroup;

    const matteGreyMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.4,
      metalness: 0.1,
    });
    const matteLightGreyMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.3,
    });
    const accentOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xed6d46,
      roughness: 0.2,
    });

    const baseGeo = new THREE.CylinderGeometry(0.65, 0.7, 0.08, 32);
    const baseMesh = new THREE.Mesh(baseGeo, accentOrangeMat);
    baseMesh.position.y = 0.04;
    mannequinGroup.add(baseMesh);

    const torsoGeo = new THREE.CylinderGeometry(0.3, 0.22, 0.85, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, matteGreyMat);
    torsoMesh.position.y = 0.9;
    torsoMesh.castShadow = true;
    mannequinGroup.add(torsoMesh);

    const shoulderGeo = new THREE.BoxGeometry(0.76, 0.12, 0.22);
    const shoulderMesh = new THREE.Mesh(shoulderGeo, matteLightGreyMat);
    shoulderMesh.position.y = 1.32;
    mannequinGroup.add(shoulderMesh);

    const neckGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12);
    const neckMesh = new THREE.Mesh(neckGeo, matteGreyMat);
    neckMesh.position.y = 1.45;
    mannequinGroup.add(neckMesh);

    const headGeo = new THREE.SphereGeometry(0.2, 24, 24);
    const headMesh = new THREE.Mesh(headGeo, matteLightGreyMat);
    headMesh.position.y = 1.62;
    headMesh.castShadow = true;
    mannequinGroup.add(headMesh);
    headMeshRef.current = headMesh;

    const noseGeo = new THREE.ConeGeometry(0.05, 0.18, 12);
    const noseMesh = new THREE.Mesh(noseGeo, accentOrangeMat);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.set(0, 1.62, 0.22);
    mannequinGroup.add(noseMesh);

    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.65, 12);
    const leftArm = new THREE.Mesh(armGeo, matteGreyMat);
    leftArm.position.set(-0.42, 1.0, 0);
    leftArm.rotation.z = 0.15;
    const rightArm = new THREE.Mesh(armGeo, matteGreyMat);
    rightArm.position.set(0.42, 1.0, 0);
    rightArm.rotation.z = -0.15;
    mannequinGroup.add(leftArm);
    mannequinGroup.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.8, 12);
    const leftLeg = new THREE.Mesh(legGeo, matteGreyMat);
    leftLeg.position.set(-0.15, 0.45, 0);
    const rightLeg = new THREE.Mesh(legGeo, matteGreyMat);
    rightLeg.position.set(0.15, 0.45, 0);
    mannequinGroup.add(leftLeg);
    mannequinGroup.add(rightLeg);

    // 9. 3D Camera Object
    const cameraGroup = new THREE.Group();
    scene.add(cameraGroup);
    cameraMeshRef.current = cameraGroup;

    const bodyGeo = new THREE.BoxGeometry(0.38, 0.28, 0.24);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.8 });
    const camMesh = new THREE.Mesh(bodyGeo, bodyMat);
    cameraGroup.add(camMesh);

    const lensGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.28, 16);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xed6d46, metalness: 0.9 });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.rotation.x = Math.PI / 2;
    lensMesh.position.z = 0.22;
    cameraGroup.add(lensMesh);

    // Sight Line
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xed6d46,
      dashSize: 0.1,
      gapSize: 0.08,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.2, 0),
    ]);
    const sightLine = new THREE.Line(lineGeo, lineMat);
    sightLine.computeLineDistances();
    scene.add(sightLine);
    sightLineRef.current = sightLine;

    // 10. Render Loop
    let animId: number;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      if (mainRendererRef.current && sceneRef.current && mainCameraRef.current) {
        mainRendererRef.current.render(sceneRef.current, mainCameraRef.current);
      }
      if (viewfinderRendererRef.current && sceneRef.current && viewfinderCameraRef.current) {
        viewfinderRendererRef.current.render(sceneRef.current, viewfinderCameraRef.current);
      }
    };
    renderLoop();

    const handleResize = () => {
      if (!containerRef.current || !mainRendererRef.current || !mainCameraRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      mainCameraRef.current.aspect = width / height;
      mainCameraRef.current.updateProjectionMatrix();
      mainRendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      mainRenderer.dispose();
      vfRenderer.dispose();
    };
  }, []);

  // Update 3D Positions & Dynamic Viewfinder FOV Zoom
  useEffect(() => {
    if (!mannequinGroupRef.current || !cameraMeshRef.current || !sightLineRef.current || !viewfinderCameraRef.current) return;

    // 1. Update Viewfinder Camera FOV when Focal Length changes (PRD Feature 1)
    const targetFov = focalLengthToFov(spec.camera.focalLength || 50);
    if (viewfinderCameraRef.current.fov !== targetFov) {
      viewfinderCameraRef.current.fov = targetFov;
      viewfinderCameraRef.current.updateProjectionMatrix();
    }

    // 2. Mannequin Rotations
    const bodyRad = (spec.subject.bodyYaw * Math.PI) / 180;
    mannequinGroupRef.current.rotation.y = bodyRad;

    if (headMeshRef.current) {
      headMeshRef.current.rotation.y = (spec.subject.headYaw * Math.PI) / 180;
      headMeshRef.current.rotation.x = (spec.subject.headPitch * Math.PI) / 180;
    }

    // 3. Camera 3D Position & Framing Target Y Scaling
    const distM = spec.camera.distanceNum || 3.5;
    const r = distM * 0.95;
    const azRad = (spec.camera.azimuth * Math.PI) / 180;
    const elRad = (spec.camera.elevation * Math.PI) / 180;

    // Framing height targeting (Head vs Chest vs Mid-Thigh vs Full Body)
    let targetY = 1.05;
    const fr = spec.composition.framing;
    if (fr === 'face') targetY = 1.60;
    else if (fr === 'chest') targetY = 1.35;
    else if (fr === 'waist') targetY = 1.15;
    else if (fr === 'mid_thigh') targetY = 0.95;
    else if (fr === 'full_body' || fr === 'calf' || fr === 'knee') targetY = 0.85;

    const camX = r * Math.cos(elRad) * Math.sin(azRad);
    const camY = targetY + r * Math.sin(elRad);
    const camZ = r * Math.cos(elRad) * Math.cos(azRad);

    cameraMeshRef.current.position.set(camX, camY, camZ);
    cameraMeshRef.current.lookAt(0, targetY, 0);

    // 4. Viewfinder Camera Position & Dynamic Framing LookAt
    viewfinderCameraRef.current.position.set(camX, camY, camZ);
    viewfinderCameraRef.current.lookAt(0, targetY, 0);

    // 5. Sight Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(camX, camY, camZ),
      new THREE.Vector3(0, targetY, 0),
    ]);
    sightLineRef.current.geometry.dispose();
    sightLineRef.current.geometry = lineGeo;
    sightLineRef.current.computeLineDistances();
  }, [spec]);

  // Mouse Wheel Distance Zoom (PRD Feature 2)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.25 : -0.25;
    onChangeSpec((prev) => {
      const curDist = prev.camera.distanceNum || 3.5;
      const nextDist = Math.max(1.5, Math.min(7.0, Math.round((curDist + delta) * 10) / 10));
      return {
        ...prev,
        camera: {
          ...prev.camera,
          distanceNum: nextDist,
        },
      };
    });
  };

  // Drag Handler with Magnetic Angle Snap
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    onChangeSpec((prev) => {
      if (dragMode === 'camera') {
        let rawAz = prev.camera.azimuth + deltaX * 0.85;
        if (rawAz > 180) rawAz -= 360;
        if (rawAz < -180) rawAz += 360;

        let finalAz = Math.round(rawAz);
        let snapped = false;
        let snapLabel = '';

        if (snapEnabled) {
          for (const targetDeg of SNAP_ANGLES) {
            if (Math.abs(rawAz - targetDeg) <= SNAP_THRESHOLD) {
              finalAz = targetDeg;
              snapped = true;
              snapLabel = `${targetDeg > 0 ? `+${targetDeg}°` : `${targetDeg}°`} (自动磁吸已对齐)`;
              break;
            }
          }
        }

        setIsSnapped(snapped);
        setSnappedAngleName(snapLabel);

        let newEl = prev.camera.elevation - deltaY * 0.5;
        newEl = Math.max(-30, Math.min(60, Math.round(newEl)));

        return {
          ...prev,
          camera: {
            ...prev.camera,
            azimuth: finalAz,
            elevation: newEl,
          },
        };
      } else {
        let newBody = prev.subject.bodyYaw + deltaX * 0.85;
        if (newBody > 180) newBody -= 360;
        if (newBody < -180) newBody += 360;

        return {
          ...prev,
          subject: {
            ...prev.subject,
            bodyYaw: Math.round(newBody),
          },
        };
      }
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Find LUT CSS filter matching `spec.camera.lutPreset`
  const activeLut = LUT_PRESETS.find((l) => l.id === spec.camera.lutPreset) || LUT_PRESETS[0];

  return (
    <div
      onWheel={handleWheel}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f5f9] select-none font-sans shadow-inner"
    >
      {/* Main 3D Studio Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* TOP FLOATING TOGGLE HUD (Directly aligned with top-right Viewfinder) */}
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-white/90 p-1.5 backdrop-blur-md border border-slate-200/80 shadow-md">
        <button
          type="button"
          onClick={() => setDragMode('camera')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
            dragMode === 'camera'
              ? 'bg-[#172238] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Camera className="h-3.5 w-3.5" /> 拖拽相机
        </button>
        <button
          type="button"
          onClick={() => setDragMode('model')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
            dragMode === 'model'
              ? 'bg-[#172238] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="h-3.5 w-3.5" /> 模特转身
        </button>
        <div className="h-4 w-px bg-slate-200 my-auto" />
        <button
          type="button"
          onClick={() => onChangeSpec((prev) => ({ ...prev, camera: { ...prev.camera, distanceNum: 1.8, focalLength: 85 } }))}
          className={`rounded-lg px-2 py-1 text-[0.68rem] font-bold transition ${
            spec.camera.distanceNum === 1.8
              ? 'bg-[#ed6d46] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          特写 1.8m
        </button>
        <button
          type="button"
          onClick={() => onChangeSpec((prev) => ({ ...prev, camera: { ...prev.camera, distanceNum: 3.2, focalLength: 50 } }))}
          className={`rounded-lg px-2 py-1 text-[0.68rem] font-bold transition ${
            spec.camera.distanceNum === 3.2
              ? 'bg-[#ed6d46] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          中景 3.2m
        </button>
        <button
          type="button"
          onClick={() => onChangeSpec((prev) => ({ ...prev, camera: { ...prev.camera, distanceNum: 4.8, focalLength: 35 } }))}
          className={`rounded-lg px-2 py-1 text-[0.68rem] font-bold transition ${
            spec.camera.distanceNum === 4.8
              ? 'bg-[#ed6d46] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          全身 4.8m
        </button>
        <div className="h-4 w-px bg-slate-200 my-auto" />
        <button
          type="button"
          onClick={() => {
            setVfPos(null);
            onChangeSpec((prev) => ({
              ...prev,
              camera: {
                ...prev.camera,
                azimuth: 0,
                elevation: 0,
                distanceNum: 3.5,
                focalLength: 50,
              },
              subject: {
                ...prev.subject,
                bodyYaw: 0,
                headYaw: 0,
                headPitch: 0,
              },
            }));
          }}
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[0.68rem] font-black text-slate-700 hover:bg-slate-200 transition"
          title="重置相机视角与取景器"
        >
          <RotateCcw className="h-3 w-3 text-[#ed6d46]" /> 重置视角
        </button>
      </div>

      {/* MAGNETIC SNAP INDICATOR BADGE */}
      {isSnapped && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#ed6d46] px-3.5 py-1 text-xs font-black text-white shadow-md animate-bounce">
          🎯 {snappedAngleName}
        </div>
      )}

      {/* FREELY DRAGGABLE LIVE CAMERA VIEWFINDER (按住标题栏可自由拖拽放置于下方或任意位置) */}
      <div
        style={
          vfPos
            ? { left: `${vfPos.x}px`, top: `${vfPos.y}px` }
            : { bottom: '16px', right: '16px' }
        }
        className="absolute z-40 overflow-hidden rounded-2xl border-2 border-[#172238] bg-slate-900 shadow-2xl transition-shadow select-none"
      >
        {/* DRAGGABLE HEADER BAR */}
        <div
          onMouseDown={handleVfMouseDown}
          className="flex cursor-grab active:cursor-grabbing items-center justify-between bg-[#172238] px-3 py-1.5 text-[0.68rem] font-black text-white hover:bg-slate-800 transition"
          title="按住拖拽取景器位置"
        >
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE 取景器 ≡
          </span>
          <span className="text-orange-300 font-mono">
            {spec.camera.focalLength}mm · {activeLut.name}
          </span>
        </div>
        <div className="relative">
          {/* Viewfinder Canvas Target with Realtime LUT CSS Filter */}
          <div
            ref={viewfinderRef}
            className="h-[150px] w-[215px] transition-all duration-300"
            style={{ filter: activeLut.cssFilter }}
          />
          {/* Safe Frame Lines & FOV Framing Indicator */}
          <div className="pointer-events-none absolute inset-0 border border-white/20">
            <div className="absolute left-1/2 top-0 h-full w-px border-l border-dashed border-white/25" />
            <div className="absolute top-1/2 left-0 w-full h-px border-t border-dashed border-white/25" />
          </div>
        </div>
      </div>

      {/* BOTTOM REALTIME READOUT HUD */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-xl bg-white/90 px-3.5 py-2 text-xs font-black text-slate-800 backdrop-blur-md border border-slate-200/80 shadow-md">
        <span>
          方位角: <strong className="text-[#ed6d46] font-mono">{spec.camera.azimuth}°</strong>
        </span>
        <span>
          仰俯角: <strong className="text-slate-600 font-mono">{spec.camera.elevation}°</strong>
        </span>
        <span>
          距离: <strong className="text-[#ed6d46] font-mono">{spec.camera.distanceNum || 3.5}m</strong>
        </span>
        <span>
          模特: <strong className="text-slate-600 font-mono">{spec.subject.bodyYaw}°</strong>
        </span>
      </div>
    </div>
  );
};

export default Virtual3DStudioCanvas;
