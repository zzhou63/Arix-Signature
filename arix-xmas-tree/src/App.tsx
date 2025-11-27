import React, { useMemo, useRef, useState, useTransition } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import { random } from 'maath'; // 用于生成随机数，如果未安装可使用自定义函数

// --- 1. 配置常量 (Art Direction Config) ---
const CONFIG = {
  count: 1500, // 粒子数量 (奢华感需要密度)
  colors: ['#004225', '#0f5e3e', '#FFD700', '#C5A059'], // 祖母绿 + 两种金色
  scatterRadius: 15, // 散落状态的爆炸范围
  treeHeight: 8,     // 树高
  treeRadius: 3.5,   // 树底半径
  animSpeed: 2.5,    // 聚合/散开的速度
};

// --- 2. 辅助数学函数 (Math Helpers) ---

/**
 * 生成双位置系统数据
 * @param count 数量
 */
const generateData = (count: number) => {
  const scatterPositions = new Float32Array(count * 3);
  const treePositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  
  const dummyColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // A. Scatter Position: 随机分布在球体中
    // 使用极坐标随机分布，制造“星尘”感
    const r = CONFIG.scatterRadius * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    scatterPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
    scatterPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 2; // 稍微抬高一点
    scatterPositions[i3 + 2] = r * Math.cos(phi);

    // B. Tree Position: 斐波那契螺旋圆锥 (Fibonacci Spiral Cone)
    // 这种排列方式比纯随机更优雅，更有“设计感”
    const percent = i / count; 
    const y = percent * CONFIG.treeHeight; // 高度从 0 到 h
    const radiusAtY = (1 - percent) * CONFIG.treeRadius; // 越往上半径越小
    const angle = i * 2.4; // 黄金角近似值，制造螺旋

    treePositions[i3] = Math.cos(angle) * radiusAtY;
    treePositions[i3 + 1] = y - CONFIG.treeHeight / 2 + 2; // 居中调整
    treePositions[i3 + 2] = Math.sin(angle) * radiusAtY;

    // C. Colors & Scales
    // 随机分配金色或绿色，金色占比少但亮
    const isGold = Math.random() > 0.7;
    dummyColor.set(isGold ? CONFIG.colors[2 + Math.floor(Math.random()*2)] : CONFIG.colors[Math.floor(Math.random()*2)]);
    dummyColor.toArray(colors, i3);

    // 顶部粒子更小，底部更大
    scales[i] = Math.random() * 0.5 + 0.2; 
  }

  return { scatterPositions, treePositions, colors, scales };
};

// --- 3. 核心组件 (The Artifact) ---

const SignatureTree = ({ mode }: { mode: 'SCATTERED' | 'TREE_SHAPE' }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { scatterPositions, treePositions, colors, scales } = useMemo(() => generateData(CONFIG.count), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // 动画状态引用 (0 = Scattered, 1 = Tree)
  const progress = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. 平滑状态过渡 (State Transition)
    const target = mode === 'TREE_SHAPE' ? 1 : 0;
    // 使用阻尼平滑插值 (Dampening)
    progress.current = THREE.MathUtils.lerp(progress.current, target, delta * CONFIG.animSpeed);

    const t = progress.current;
    
    // 2. 遍历并更新每个实例矩阵 (Matrix Update)
    for (let i = 0; i < CONFIG.count; i++) {
      const i3 = i * 3;

      // 获取当前插值位置
      const x = THREE.MathUtils.lerp(scatterPositions[i3], treePositions[i3], t);
      const y = THREE.MathUtils.lerp(scatterPositions[i3 + 1], treePositions[i3 + 1], t);
      const z = THREE.MathUtils.lerp(scatterPositions[i3 + 2], treePositions[i3 + 2], t);

      // 添加“呼吸”动效 (Breathing) - 让奢华感是活的
      // 当 t 接近 1 (树形态) 时，呼吸幅度小；t 接近 0 (散落) 时，漂浮幅度大
      const time = state.clock.elapsedTime;
      const floatRange = 0.1 + (1 - t) * 0.5; 
      const floatY = Math.sin(time * 0.5 + i * 0.1) * floatRange;

      // 旋转动效：散落时乱转，聚合时轻微自旋
      const rotX = (1-t) * time * 0.2;
      const rotY = time * 0.1 + (i * 0.01);
      
      dummy.position.set(x, y + floatY, z);
      dummy.rotation.set(rotX, rotY, 0);
      dummy.scale.setScalar(scales[i] * (0.5 + 0.5 * t)); // 聚拢时变大一点
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFIG.count]}>
      {/* 几何体：使用八面体或四面体，比球体更有钻石切割感，反光更好 */}
      <octahedronGeometry args={[0.2, 0]} />
      {/* 材质：高物理感，强调金属和光泽 */}
      <meshPhysicalMaterial 
        vertexColors 
        toneMapped={false} // 让 Bloom 更强烈
        roughness={0.15}   // 光滑
        metalness={0.9}    // 纯金属质感
        emissiveIntensity={0.5} // 自发光微量
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
};

// --- 4. 场景组装 (Scene Setup) ---

export default function ArixChristmasExperience() {
  const [mode, setMode] = useState<'SCATTERED' | 'TREE_SHAPE'>('TREE_SHAPE');
  
  // 简单的 UI 切换逻辑
  const toggleMode = () => setMode(prev => prev === 'TREE_SHAPE' ? 'SCATTERED' : 'TREE_SHAPE');

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505' }}>
      <Canvas 
        camera={{ position: [0, 0, 12], fov: 45 }}
        gl={{ antialias: false }} // 后期处理通常建议关闭原生 AA
        dpr={[1, 1.5]} // 性能优化
      >
        {/* A. 奢华灯光系统 */}
        <ambientLight intensity={0.5} color="#001a10" />
        <spotLight position={[10, 20, 10]} angle={0.3} penumbra={1} intensity={2} color="#ffd700" castShadow />
        {/* 背光/轮廓光，制造电影感 */}
        <spotLight position={[-10, 5, -10]} angle={0.5} intensity={5} color="#00ff88" />
        
        {/* B. 环境贴图 - 提供金属反射源 */}
        <Environment preset="city" environmentIntensity={0.8} />

        {/* C. 核心组件 */}
        <SignatureTree mode={mode} />

        {/* D. 后期特效 - 灵魂所在 */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={1.1} // 只有非常亮的部分才会发光（金属高光）
            mipmapBlur 
            intensity={1.5} 
            radius={0.6}
          />
          <ToneMapping />
        </EffectComposer>

        <ContactShadows opacity={0.5} scale={20} blur={2} far={4} color="#000000" />
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 1.8}
          autoRotate={mode === 'TREE_SHAPE'} // 树形态时自动展示
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* E. 交互 UI */}
      <div style={{
        position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', fontFamily: 'Cinzel, serif', pointerEvents: 'none'
      }}>
        <h1 style={{ 
          color: '#e5c07b', margin: 0, fontSize: '2rem', letterSpacing: '0.2em', textTransform: 'uppercase',
          textShadow: '0 0 10px rgba(229, 192, 123, 0.5)'
        }}>
          The Arix Signature
        </h1>
        <button 
          onClick={toggleMode}
          style={{
            marginTop: '20px', padding: '12px 30px', 
            background: 'transparent', border: '1px solid #e5c07b', color: '#e5c07b',
            cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.1em',
            pointerEvents: 'auto', transition: 'all 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(229, 192, 123, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {mode === 'TREE_SHAPE' ? 'DISPERSE' : 'ASSEMBLE'}
        </button>
      </div>
    </div>
  );
}