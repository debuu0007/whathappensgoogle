import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function createAssetLoader(renderer, onProgress = () => {}) {
  const manager = new LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(total ? loaded / total : 0);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(renderer);
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  return { manager, gltf, ktx2 };
}
