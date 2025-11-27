import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';

// --- 1. 配置常量 & 风格定义 ---
const CONFIG = {
  count: 1200, // 粒子数量
  colors: ['#003311', '#005522', '#FFD700', '#E6C200'], // 深祖母绿 + 奢华金
  scatterRadius: 20,
  treeHeight: 9,
  treeRadius: 4,
  animSpeed: 2.0,
};

const GOLD_COLOR = '#e5c07b';
const FONT_FAMILY = '"Cinzel", serif';

// --- 2. 辅助数学函数 (包含树星逻辑) ---
const generateData = (count: number) => {
  // 多加一个粒子作为顶部的星星
  const totalCount = count + 1;
  const scatterPositions = new Float32Array(totalCount * 3);
  const treePositions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);
  const scales = new Float32Array(totalCount);
  const dummyColor = new THREE.Color();

  // A. 生成树身粒子
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // Scatter Position
    const r = CONFIG.scatterRadius * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    scatterPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
    scatterPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) + CONFIG.treeHeight/2;
    scatterPositions[i3 + 2] = r * Math.cos(phi);

    // Tree Position (Fibonacci Spiral)
    const percent = i / count;
    const y = percent * CONFIG.treeHeight;
    const radiusAtY = (1 - percent) * CONFIG.treeRadius;
    const angle = i * 2.4;
    treePositions[i3] = Math.cos(angle) * radiusAtY;
    treePositions[i3 + 1] = y - CONFIG.treeHeight / 2;
    treePositions[i3 + 2] = Math.sin(angle) * radiusAtY;

    // Color & Scale
    const colorSet = Math.random() > 0.6 ? 2 : 0; // 金色少一点
    dummyColor.set(CONFIG.colors[colorSet + Math.floor(Math.random() * 2)]);
    dummyColor.toArray(colors, i3);
    scales[i] = Math.random() * 0.6 + 0.15;
  }

  // B. 生成顶部树星 (最后一个粒子)
  const starIndex = count;
  const i3 = starIndex * 3;
  // Star Scatter Position (在上方随机)
  scatterPositions[i3] = (Math.random()-0.5) * 5;
  scatterPositions[i3+1] = CONFIG.treeHeight + 5;
  scatterPositions[i3+2] = (Math.random()-0.5) * 5;
  // Star Tree Position (正顶点)
  treePositions[i3] = 0;
  treePositions[i3+1] = CONFIG.treeHeight / 2 + 0.8;
  treePositions[i3+2] = 0;
  // Star Color (纯金)
  dummyColor.set(CONFIG.colors[2]).toArray(colors, i3);
  // Star Scale (特大)
  scales[starIndex] = 2.5;

  return { scatterPositions, treePositions, colors, scales, totalCount };
};

// --- 3. 核心 3D 组件 ---
const SignatureTree = ({ mode }: { mode: 'SCATTERED' | 'TREE_SHAPE' }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { scatterPositions, treePositions, colors, scales, totalCount } = useMemo(() => generateData(CONFIG.count), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const progress = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    progress.current = THREE.MathUtils.lerp(progress.current, mode === 'TREE_SHAPE' ? 1 : 0, delta * CONFIG.animSpeed);
    const t = progress.current;

    for (let i = 0; i < totalCount; i++) {
      const i3 = i * 3;
      // 位置插值
      const x = THREE.MathUtils.lerp(scatterPositions[i3], treePositions[i3], t);
      const y = THREE.MathUtils.lerp(scatterPositions[i3 + 1], treePositions[i3 + 1], t);
      const z = THREE.MathUtils.lerp(scatterPositions[i3 + 2], treePositions[i3 + 2], t);
      
      // 呼吸与旋转动效
      const time = state.clock.elapsedTime;
      const isStar = i === totalCount - 1;
      // 星星呼吸慢一点，其他快一点
      const floatY = Math.sin(time * (isStar ? 0.5 : 1) + i * 0.1) * (isStar ? 0.1 : 0.05) * (1-t*0.5);

      dummy.position.set(x, y + floatY, z);
      // 星星只自转，不乱转
      dummy.rotation.set(isStar ? 0 : (1-t)*time, time * 0.2 + i*0.01, 0);
      const currentScale = scales[i] * (isStar ? 1 : (0.3 + 0.7 * t));
      dummy.scale.setScalar(currentScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // 开启 castShadow 和 receiveShadow 让宝石之间可以互相投影，增加真实感
    <instancedMesh ref={meshRef} args={[undefined, undefined, totalCount]} castShadow receiveShadow>
      <octahedronGeometry args={[0.3, 0]} />
      <meshPhysicalMaterial 
        vertexColors 
        toneMapped={false}
        roughness={0.1}   // 极度光滑
        metalness={0.95}  // 高金属度
        emissiveIntensity={0} // 关闭自发光，完全靠外部光照
        envMapIntensity={1}
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
};

// --- 4. 全新奢华 UI 组件 ---
const LuxuryUI = ({ mode, toggleMode }: { mode: 'SCATTERED' | 'TREE_SHAPE', toggleMode: () => void }) => {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      padding: '60px', boxSizing: 'border-box', pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      fontFamily: FONT_FAMILY, color: GOLD_COLOR, zIndex: 10
    }}>
      {/* 左上角标题区 */}
      <div>
        <h1 style={{ margin: 0, fontSize: '4rem', lineHeight: 0.9, letterSpacing: '0.05em', fontWeight: 700 }}>
          GRAND<br/>LUXURY
        </h1>
        <div style={{ 
          display: 'inline-block', border: `1px solid ${GOLD_COLOR}`, padding: '6px 12px', 
          marginTop: '16px', fontSize: '0.9rem', letterSpacing: '0.2em', fontWeight: 400
        }}>
          INTERACTIVE TREE
        </div>
      </div>

      {/* 右下角操作区 */}
      <div style={{ textAlign: 'right', alignSelf: 'flex-end' }}>
        <button
          onClick={toggleMode}
          style={{
            background: 'transparent', border: `2px solid ${GOLD_COLOR}`, color: GOLD_COLOR,
            padding: '16px 48px', fontSize: '1.1rem', letterSpacing: '0.2em', cursor: 'pointer',
            pointerEvents: 'auto', fontFamily: FONT_FAMILY, transition: 'all 0.3s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = GOLD_COLOR; e.currentTarget.style.color = '#000'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = GOLD_COLOR; }}
        >
          {mode === 'TREE_SHAPE' ? 'DISPERSE' : 'ASSEMBLE'}
        </button>
        <div style={{ marginTop: '20px', fontSize: '0.75rem', letterSpacing: '0.15em', opacity: 0.7, lineHeight: 1.5 }}>
          EST. 2024<br/>THE GOLD STANDARD
        </div>
      </div>
    </div>
  );
};

// --- 5. 主场景 ---
export default function App() {
  const [mode, setMode] = useState<'SCATTERED' | 'TREE_SHAPE'>('TREE_SHAPE');

  return (
    <>
      <Canvas shadows camera={{ position: [0, 2, 14], fov: 40 }} gl={{ antialias: false }}>
        <color attach="background" args={['#000000']} />
        
        {/* --- 核心：戏剧性布光 --- */}
        <ambientLight intensity={0.02} /> {/* 极暗环境光 */}
        
        {/* 主聚光灯：从正上方打下，制造光锥和强烈阴影 */}
        <spotLight
          position={[0, 30, 0]}
          angle={0.25}       // 光锥角度
          penumbra={0.4}     // 边缘柔和度
          intensity={20}     // 极高强度
          color="#fffdf0"    // 暖白光
          castShadow
          shadow-mapSize={[2048, 2048]} // 高质量阴影
          shadow-bias={-0.0001}
          target-position={[0, -2, 0]}
        />
        
        {/* 辅助侧逆光：勾勒边缘轮廓 */}
        <spotLight position={[10, 5, -10]} angle={0.4} intensity={3} color="#e5c07b" />
        <spotLight position={[-10, 10, 5]} angle={0.4} intensity={1} color="#005522" />

        {/* 环境反射：调暗，只提供金属反射源 */}
        <Environment preset="lobby" environmentIntensity={0.1} />

        <SignatureTree mode={mode} />

        {/* 接触阴影：强调落地感 */}
        <ContactShadows position={[0, -CONFIG.treeHeight/2 - 0.5, 0]} opacity={0.8} scale={25} blur={2.5} far={10} color="#000" />

        {/* 后期处理：辉光 */}
        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1.5} mipmapBlur intensity={1.2} radius={0.5} />
          <ToneMapping />
        </EffectComposer>

        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI/3} maxPolarAngle={Math.PI/1.8} autoRotate={mode === 'TREE_SHAPE'} autoRotateSpeed={0.3} />
      </Canvas>

      <LuxuryUI mode={mode} toggleMode={() => setMode(m => m === 'TREE_SHAPE' ? 'SCATTERED' : 'TREE_SHAPE')} />
    </>
  );
}