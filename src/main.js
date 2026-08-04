import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing';
import hops from './content/hops.json';
import { JourneyState } from './core/state.js';
import { createLoop } from './core/loop.js';
import { SceneManager } from './scenes/sceneManager.js';
import { CameraController } from './camera/controller.js';
import { UI } from './ui/ui.js';
import { createAssetLoader } from './assets/loaders.js';
import './styles.css';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070b); scene.fog = new THREE.FogExp2(0x05070b, .012);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 250); camera.position.set(0, 1.3, 13);
scene.add(new THREE.HemisphereLight(0x81dcff, 0x090a11, 1.45)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 8, 8); scene.add(key);
const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x40616d, size: .025, transparent: true, opacity: .55 }));
const starPos = new Float32Array(1800 * 3); for (let i=0;i<starPos.length;i+=3){starPos[i]=(Math.random()-.5)*90;starPos[i+1]=(Math.random()-.5)*35;starPos[i+2]=-Math.random()*120+15;} stars.geometry.setAttribute('position',new THREE.BufferAttribute(starPos,3)); scene.add(stars);

const state = new JourneyState(hops); const scenes = new SceneManager(scene, hops); const cameraController = new CameraController(camera, canvas, state, hops); const ui = new UI(state, hops, camera, scenes);
const assetLoader = createAssetLoader(renderer); void assetLoader;
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); const bloom = new BloomEffect({ intensity: .8, luminanceThreshold: .4, luminanceSmoothing: .3, mipmapBlur: true }); composer.addPass(new EffectPass(camera, bloom));
const resize = () => { const width=innerWidth,height=innerHeight; camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);}; addEventListener('resize',resize,{passive:true});
state.addEventListener('change',({detail})=>{
  const s=detail.value; const hop=hops[s.hopIndex]; const spot=hop.hotspots.find((item)=>item.id===s.focusedHotspot);
  scenes.setFocus(s.hopIndex, spot?.anchorMesh ?? null);
  if(detail.reason==='FINISH'){ scenes.playFinale(); window.setTimeout(()=>state.send('SETTLED'),1800); }
});

const loop = createLoop((delta, elapsed) => { cameraController.update(delta, elapsed); scenes.update(delta, elapsed); stars.rotation.y += delta * .006; ui.updateAnchors(); }, () => composer.render());
loop.start();
window.setTimeout(() => state.send('READY'), 650);

if (import.meta.env.DEV) import('lil-gui').then(({ default: GUI }) => { const gui=new GUI({title:'Camera authoring'}); const actions={copyPose:async()=>{await navigator.clipboard.writeText(JSON.stringify(cameraController.pose())); console.info('Camera pose copied',cameraController.pose());}}; gui.add(actions,'copyPose').name('Copy pose as JSON'); gui.close(); });
