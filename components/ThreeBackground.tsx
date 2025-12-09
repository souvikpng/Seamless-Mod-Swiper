import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CyberGridShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#fcee0a') }, // Yellow
    uColor2: { value: new THREE.Color('#ff003c') }, // Red
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 gridUv = vUv * 20.0;
      gridUv.y += uTime * 2.0;
      
      float gridX = step(0.95, fract(gridUv.x));
      float gridY = step(0.95, fract(gridUv.y));
      float grid = max(gridX, gridY);

      // Noise / Glitch
      float noise = random(floor(gridUv) + floor(uTime * 5.0));
      float glitch = step(0.98, noise);

      vec3 color = mix(vec3(0.05), uColor1, grid);
      color = mix(color, uColor2, glitch);

      // Scanline vignette
      float scanline = sin(vUv.y * 200.0 + uTime * 10.0) * 0.1;
      float vignette = 1.0 - distance(vUv, vec2(0.5));
      
      gl_FragColor = vec4(color * vignette + scanline, 1.0);
    }
  `
};

const BackgroundPlane = () => {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#2a2a2a') },
    uColor2: { value: new THREE.Color('#fcee0a') }
  }), []);

  useFrame((state) => {
    if (mesh.current) {
      const material = mesh.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 4, 0, 0]} position={[0, -2, -5]} scale={[30, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={CyberGridShader.vertexShader}
        fragmentShader={CyberGridShader.fragmentShader}
        transparent={true}
      />
    </mesh>
  );
};

const ThreeBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 -z-10 bg-cp-dark">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <BackgroundPlane />
        <ambientLight intensity={0.5} />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-t from-cp-black via-transparent to-transparent opacity-80 pointer-events-none" />
    </div>
  );
};

export default ThreeBackground;
