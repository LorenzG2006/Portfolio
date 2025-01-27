import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import Image from './assets/image.jpg';
import Space from './assets/space.jpg';
import Moon from './assets/moon.jpg';
import Normal from './assets/normal.jpg';
import ModelPath from './assets/shooting_star.glb';
import Earth from './assets/solar-system/textures/earth.jpeg';

// Constants and arrays for star management
const mixers = []; // Store mixers for updates
const stars = []; // Store stars with their creation time and fading state
const STAR_LIFETIME = 10000; // Lifetime of each star in milliseconds (10 seconds)
const FADE_DURATION = 2000; // Duration of the fade-out effect in milliseconds

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#canvas'),
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Camera position
camera.position.setZ(30);
camera.position.setX(-3);

// Lights
const pointLight = new THREE.PointLight(0xffffff);
const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(pointLight, ambientLight);

// Directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5).normalize();
scene.add(directionalLight);

// Background and textures
const spaceTexture = new THREE.TextureLoader().load(Space);
scene.background = spaceTexture;
const moonTexture = new THREE.TextureLoader().load(Moon);
const normalTexture = new THREE.TextureLoader().load(Normal);
const earthTexture = new THREE.TextureLoader().load(Earth);

// Add stars to the scene
function addStar() {
  const geometry = new THREE.SphereGeometry(0.25, 24, 24);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const star = new THREE.Mesh(geometry, material);
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(100));
  star.position.set(x, y, z);
  scene.add(star);
}
Array(200).fill().forEach(addStar);

// Image mesh
const imageTexture = new THREE.TextureLoader().load(Image);
const image = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial({ map: imageTexture }));
scene.add(image);
image.position.z = -5;
image.position.x = 2;

// Moon mesh
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  new THREE.MeshStandardMaterial({ map: moonTexture, normalMap: normalTexture })
);
moon.castShadow = true;
moon.receiveShadow = true;
scene.add(moon);
moon.position.z = 30;
moon.position.setX(-10);

// Particles system
const particles = new THREE.BufferGeometry();
const particleCount = 1000;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = Math.random() * 200 - 100;
  positions[i * 3 + 1] = Math.random() * 200 - 100;
  positions[i * 3 + 2] = Math.random() * 200 - 100;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.5,
});
const particleSystem = new THREE.Points(particles, particleMaterial);
scene.add(particleSystem);

// Reflective Sphere
const reflectiveMaterial = new THREE.MeshStandardMaterial({
  metalness: 1,
  roughness: 0.1,
});
const reflectiveSphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 8, 8),
  reflectiveMaterial,
);
scene.add(reflectiveSphere);
reflectiveSphere.position.set(-100, 0, -100);

// Earth mesh
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(4, 64, 64),
  new THREE.MeshStandardMaterial({ map: earthTexture })
);
scene.add(earth);
earth.position.z = 5;
earth.position.setX(-50);

// Fog
scene.fog = new THREE.Fog(0x000000, 1, 150);

// Particle and star management
function spawnStar() {
  const loader = new GLTFLoader();
  const randomX = THREE.MathUtils.randFloatSpread(100);
  const randomY = THREE.MathUtils.randFloatSpread(100);
  const randomZ = THREE.MathUtils.randFloatSpread(100);

  loader.load(ModelPath, function (gltf) {
    const model = gltf.scene;
    model.position.set(randomX, randomY, randomZ);
    model.rotation.set(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2)
    );

    // Shader material for stars with opacity support
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        glowColor: { value: new THREE.Color(0xffd700) },
        opacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 glowColor;
        uniform float opacity;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 5.0);
          gl_FragColor = vec4(glowColor * intensity, opacity);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    model.traverse(function (child) {
      if (child.isMesh) {
        child.material = starMaterial;
      }
    });

    const mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(function (clip) {
      const action = mixer.clipAction(clip);
      action.play();
    });

    scene.add(model);
    stars.push({
      model,
      mixer,
      createdAt: Date.now(),
      material: starMaterial,
      isFading: false,
    });
    mixers.push(mixer);
  }, undefined, function (error) {
    console.error(error);
  });
}

// Cleanup stars
function cleanupStars() {
  const now = Date.now();

  for (let i = stars.length - 1; i >= 0; i--) {
    const { model, mixer, createdAt, material, isFading } = stars[i];

    if (!isFading && now - createdAt > STAR_LIFETIME - FADE_DURATION) {
      stars[i].isFading = true; // Mark as fading
    }

    if (isFading) {
      const fadeProgress = (now - (createdAt + STAR_LIFETIME - FADE_DURATION)) / FADE_DURATION;
      material.uniforms.opacity.value = 1.0 - fadeProgress;

      if (fadeProgress >= 1.0) {
        scene.remove(model);
        mixer.uncacheRoot(model);
        stars.splice(i, 1);
      }
    }
  }
}

// Camera movement
function moveCamera() {
  const t = document.body.getBoundingClientRect().top;
  moon.rotation.x += 0.05;
  moon.rotation.y += 0.075;
  moon.rotation.z += 0.05;
  image.rotation.y += 0.01;
  image.rotation.z += 0.01;
  camera.position.z = t * -0.01;
  camera.position.x = t * -0.0002;
  camera.rotation.y = t * -0.0002;
}

document.body.onscroll = moveCamera;
moveCamera();

// Post-processing effects
const clock = new THREE.Clock();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
composer.addPass(bloomPass);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  moon.rotation.x += 0.005;

  cleanupStars();
  mixers.forEach(function (mixer) {
    mixer.update(delta);
  });

  composer.render();
}

// Window resize event
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial call to animate
animate();

// Spawn stars at regular intervals
setInterval(spawnStar, 2000);
