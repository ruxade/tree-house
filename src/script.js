import './style.css'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

// SIZES
const sizes = { width: window.innerWidth, height: window.innerHeight }
let maxPixelRatio = 1.5
const pixelRatio = () => Math.min(window.devicePixelRatio, maxPixelRatio)

// RENDERER
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(pixelRatio())
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// sun and trees never move: the shadow map is redrawn only on load and while the roof moves
renderer.shadowMap.autoUpdate = false

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(54, sizes.width / sizes.height, 0.1, 400)
scene.add(camera)
// layer for things the AO pass must not see: alpha cut plants, beams, the path ribbon, far trees
const NO_AO = 1
camera.layers.enable(NO_AO)
const aoCamera = camera.clone()

// Seeded random so the forest is the same on every load
let seed = 11
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const range = (a, b) => a + rand() * (b - a)

// LOADING
const loadingBarElement = document.querySelector('.loading-bar')
const loadingBarPercentageElement = document.getElementById('loading-percentage')
const loadingManager = new THREE.LoadingManager(
  () => {
    loadingBarElement.classList.add('ended')
    loadingBarElement.style.transform = ''
    loadingBarPercentageElement.classList.add('ended')
    onLoaded()
  },
  (url, loaded, total) => {
    loadingBarElement.style.transform = `scaleX(${loaded / total})`
    loadingBarPercentageElement.textContent = `${Math.round(loaded / total * 100)}%`
  }
)

const textureLoader = new THREE.TextureLoader(loadingManager)
const gltfLoader = new GLTFLoader(loadingManager)
const dracoLoader = new DRACOLoader(loadingManager)
dracoLoader.setDecoderPath('/draco/gltf/')
gltfLoader.setDRACOLoader(dracoLoader)

// ENVIRONMENT: Poly Haven river_walk_1 (CC0) for sky, fill light and reflections
new RGBELoader(loadingManager).load('/textures/environmentMaps/river_walk_1_2k.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = hdr
  scene.background = hdr
})
scene.environmentIntensity = 0.5
scene.backgroundIntensity = 0.7
scene.backgroundBlurriness = 0.05
scene.backgroundRotation.y = 1.2
scene.environmentRotation.y = 1.2
scene.fog = new THREE.FogExp2(0x66693f, 0.0085)

// SUN: low warm key light from the hero view's left, grazing the balcony and backlighting the canopy
const sun = new THREE.DirectionalLight(0xffc27a, 5.5)
const SUN_DIR = new THREE.Vector3(-0.88, 0.4, 0.26).normalize()
sun.position.copy(SUN_DIR).multiplyScalar(60)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 10
sun.shadow.camera.far = 130
sun.shadow.camera.left = -26
sun.shadow.camera.right = 26
sun.shadow.camera.top = 26
sun.shadow.camera.bottom = -26
sun.shadow.bias = -0.0003
sun.shadow.normalBias = 0.04
scene.add(sun, sun.target)

scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3a3020, 0.35))

// interior lamps, no shadows: point light shadows cost six extra passes each
const lampA = new THREE.PointLight(0xffd59a, 6, 9, 1.6)
lampA.position.set(0.15, 4.7, -0.25)
const lampB = new THREE.PointLight(0xffd59a, 4, 9, 1.6)
lampB.position.set(-4, 5.4, 0.2)
scene.add(lampA, lampB)

// PBR TEXTURE SETS (Poly Haven, CC0): diffuse, OpenGL normal, packed AO/rough/metal
const pbrSet = (name) => {
  const load = (suffix, srgb) => {
    const t = textureLoader.load(`/textures/pbr/${name}_${suffix}_1k.jpg`)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const arm = load('arm', false)
  return { map: load('diff', true), normalMap: load('nor_gl', false), aoMap: arm, roughnessMap: arm, metalnessMap: arm }
}
const sets = {
  cedar: pbrSet('japanese_cedar_planks'),
  plaster: pbrSet('clay_plaster'),
  rust: pbrSet('rust_coarse_01'),
  roofMetal: pbrSet('metal_plate_02'),
  leaves: pbrSet('forest_leaves_02'),
  dirt: pbrSet('raked_dirt')
}

// tile = metres covered by one texture repeat (feeds the box UVs below)
const surface = (set, opts = {}) => {
  const { tile = 2, color = 0xffffff, ...rest } = opts
  const m = new THREE.MeshStandardMaterial({ ...sets[set], color, metalness: 1, ...rest })
  m.userData.tile = tile
  return m
}

const looks = {
  cladding: surface('cedar', { tile: 1.6, color: 0xe8c2a4, normalScale: new THREE.Vector2(1.2, 1.2) }),
  frames: surface('cedar', { tile: 1.2, color: 0x6a4634 }),
  // clay_plaster is a mid brown; colour above 1 lifts it to a pale lime render
  render: surface('plaster', { tile: 2, color: new THREE.Color(1.55, 1.42, 1.24) }),
  renderDark: surface('plaster', { tile: 2, color: new THREE.Color(1.3, 1.18, 1.02) }),
  corten: surface('rust', { tile: 1.8, color: 0xf4d2c4, metalness: 0.35 }),
  roof: surface('roofMetal', { tile: 2, color: 0x9a948c }),
  steel: surface('roofMetal', { tile: 1.5, color: 0xe6ddd0, metalness: 0.2 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.2,
    ior: 1.5, envMapIntensity: 2.4, specularIntensity: 1, depthWrite: false
  })
}

// Her model materials -> looks. Anything unlisted (furniture, lamps) keeps its own colour, made matte.
const MATERIAL_LOOK = {
  waalls: 'cladding',
  Makore: 'frames',
  Plaster: 'render',
  External_wall: 'render',
  Plaster__1__2: 'render',
  Plaster__6_: 'renderDark',
  Paint__1_: 'corten',
  Plaster__9_roof: 'roof',
  roof_gutter: 'steel'
}
// Parts walk mode collides with: shell, floors, deck, stair. Furniture is left out to keep rays cheap.
const SOLID = new Set(['waalls', 'Makore', 'Plaster', 'External_wall', 'Plaster__1__2', 'Plaster__6_', 'Paint__1_',
  'roof_gutter', 'Plasterq', 'Material_4', 'deck', 'Paint', 'Plaster__4_', 'Plaster__9_roof', 'Glass'])

// BOX UVS: the model ships without UVs, so project per face from world space
const boxUV = (geometry, tile) => {
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i))
    let u, v
    if (ay >= ax && ay >= az) { u = pos.getX(i); v = pos.getZ(i) }
    else if (ax >= az) { u = pos.getZ(i); v = pos.getY(i) }
    else { u = pos.getX(i); v = pos.getY(i) }
    uv[i * 2] = u / tile
    uv[i * 2 + 1] = v / tile
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

// HOUSE: merged by material into ~30 draw calls; the source meshes stay off-scene as colliders
const colliders = []
let roof = null

const bakeByMaterial = (root) => {
  root.updateMatrixWorld(true)
  const groups = new Map()
  root.traverse((child) => {
    if (!child.isMesh) return
    const name = child.material.name
    if (SOLID.has(name)) colliders.push(child)
    if (!groups.has(name)) groups.set(name, { source: child.material, parts: [] })
    const g = child.geometry.clone()
    g.applyMatrix4(child.matrixWorld)
    for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key)
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()])
    groups.get(name).parts.push(g)
  })
  const out = new THREE.Group()
  for (const [name, { source, parts }] of groups) {
    const geometry = mergeGeometries(parts)
    let material = looks[MATERIAL_LOOK[name]]
    if (!material && (source.transmission || /glass/i.test(name))) material = looks.glass
    if (!material) material = new THREE.MeshStandardMaterial({ color: source.color, roughness: 0.75, metalness: 0 })
    if (material.map) boxUV(geometry, material.userData.tile)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = material !== looks.glass
    mesh.receiveShadow = true
    out.add(mesh)
  }
  return out
}

gltfLoader.load('/models/house/dec_houseNoRoof.glb', (gltf) => scene.add(bakeByMaterial(gltf.scene)))
gltfLoader.load('/models/house/roof.gltf', (gltf) => {
  roof = bakeByMaterial(gltf.scene)
  scene.add(roof)
})

// Breaks up visible texture repeats: blends a second, rotated, larger sample by a soft noise mask
const antiTile = (material) => {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        float th_noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5);
          float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
          float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5);
          float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
      .replace('#include <map_fragment>', `
        vec2 th_uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.43 + 0.31;
        float th_m = smoothstep(0.3, 0.7, th_noise(vMapUv * 0.18));
        vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(map, th_uv2), th_m);
        sampledDiffuseColor.rgb *= mix(0.82, 1.12, th_noise(vMapUv * 0.07 + 3.0));
        diffuseColor *= sampledDiffuseColor;`)
  }
}

// GROUND: leaf litter (Poly Haven forest_leaves_02, CC0), level with the stair foot
const GROUND_Y = 0
const groundMaterial = surface('leaves', { tile: 3.2, color: 0x96a274 })
antiTile(groundMaterial)
const groundGeometry = new THREE.CircleGeometry(150, 96)
groundGeometry.rotateX(-Math.PI / 2)
boxUV(groundGeometry, groundMaterial.userData.tile)
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.position.y = GROUND_Y
ground.receiveShadow = true
scene.add(ground)
colliders.push(ground)

// PATH: pale earth ribbon (Poly Haven raked_dirt, CC0) from the stair foot out past the hero view
const pathCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(5.4, 0, 2.4), new THREE.Vector3(6.4, 0, 5.8), new THREE.Vector3(7.6, 0, 10),
  new THREE.Vector3(8.4, 0, 15), new THREE.Vector3(9.6, 0, 22), new THREE.Vector3(13, 0, 34)
])
const pathPoints = pathCurve.getSpacedPoints(160)
{
  const across = [-1, -0.62, -0.3, 0, 0.3, 0.62, 1]
  const alphaAt = [0, 0.75, 1, 1, 1, 0.75, 0]
  const positions = [], normals = [], colors = [], index = []
  pathPoints.forEach((p, i) => {
    const t = pathCurve.getTangentAt(i / (pathPoints.length - 1))
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize()
    const width = 1.5 + Math.sin(i * 0.37) * 0.25 + (i < 10 ? 0.4 : 0)
    across.forEach((a, k) => {
      const wobble = k === 0 || k === across.length - 1 ? range(-0.35, 0.35) : 0
      positions.push(p.x + side.x * (a * width + wobble), 0.015, p.z + side.z * (a * width + wobble))
      normals.push(0, 1, 0)
      colors.push(1, 1, 1, alphaAt[k] * (k > 0 && k < across.length - 1 ? range(0.85, 1) : 1))
    })
    if (i > 0) for (let k = 0; k < across.length - 1; k++) {
      const a = (i - 1) * across.length + k, b = a + across.length
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  g.setIndex(index)
  const m = surface('dirt', { tile: 2.2, color: 0xffefdc, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  antiTile(m)
  boxUV(g, m.userData.tile)
  const path = new THREE.Mesh(g, m)
  path.receiveShadow = true
  path.layers.set(NO_AO)
  scene.add(path)
}
const distToPath = (x, z) => pathPoints.reduce((d, p) => Math.min(d, Math.hypot(p.x - x, p.z - z)), Infinity)

// HERO VIEW: matches render 01, looking up the path at the stair, balcony and round window
const HERO = { position: new THREE.Vector3(6.9, 1.25, 12.6), target: new THREE.Vector3(-0.6, 4.3, 0.2) }
const inHeroCorridor = (x, z) => {
  const t = THREE.MathUtils.clamp(((x - HERO.target.x) * (HERO.position.x - HERO.target.x) + (z - HERO.target.z) * (HERO.position.z - HERO.target.z)) /
    ((HERO.position.x - HERO.target.x) ** 2 + (HERO.position.z - HERO.target.z) ** 2), 0, 1.3)
  const px = HERO.target.x + (HERO.position.x - HERO.target.x) * t
  const pz = HERO.target.z + (HERO.position.z - HERO.target.z) * t
  return Math.hypot(px - x, pz - z) < 2.2 + t * 4.5
}
// intro flight: high over the canopy, then a glide down onto the hero view
const introCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-20, 34, 24), new THREE.Vector3(-6, 24, 30), new THREE.Vector3(9, 9, 22), HERO.position.clone()
])
const introPoints = introCurve.getSpacedPoints(40)
const inIntroPath = (x, z) => introPoints.some(p => p.y < 26 && Math.hypot(p.x - x, p.z - z) < 7)
const nearHouse = (x, z, pad) => x > -5.5 - pad && x < 5.5 + pad && z > -3.4 - pad && z < 3.4 + pad

// FOLIAGE BACKLIGHT: leaves glow warm when the camera looks towards the sun through them
const sunViewDir = { value: new THREE.Vector3() }
const backlit = (material, strength) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunView = sunViewDir
    shader.uniforms.uSunColor = { value: new THREE.Color(0xffb25a).multiplyScalar(strength) }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;\nuniform vec3 uSunColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float th_back = pow(max(dot(normalize(-vViewPosition), uSunView), 0.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * uSunColor * (0.18 + th_back);`)
  }
}

// TREES: Poly Haven tree_small_02 + island_tree_01 (CC0), thinned in Blender (scratch script, not in repo):
// near versions ~80k tris cast shadows, far versions ~20k tris fill the forest out to the haze
const scatter = (count, rMin, rMax, gap, taken) => {
  const out = []
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const a = range(0, Math.PI * 2), r = range(rMin, rMax)
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    if (nearHouse(x, z, 3.5) || distToPath(x, z) < 3.2 || inHeroCorridor(x, z) || inIntroPath(x, z)) continue
    if ([...taken, ...out].some(s => Math.hypot(s.x - x, s.z - z) < gap)) continue
    out.push({ x, z })
  }
  return out
}
// framing trees for the hero shot, like the big trunks either side of render 01
const nearSlots = [{ x: -3.5, z: 11.5, scale: 4.4 }, { x: 10.5, z: -2.5, scale: 4.2 }, { x: -10.5, z: -7.5, scale: 4.4 }]
// a glade of about 12 m keeps the fly orbit out of the crowns
nearSlots.push(...scatter(15, 12.5, 32, 6.5, nearSlots))
const farSlots = scatter(42, 30, 85, 7, nearSlots)

const prepTree = (gltf) => {
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach((m) => {
      m.envMapIntensity = 0.6
      if (/leaves/.test(m.name)) {
        m.transparent = false
        m.side = THREE.DoubleSide
        m.color.set(0xd8e0a8)
        backlit(m, 1.1)
      }
    })
  })
  return gltf.scene
}
const nearTrees = []
const placeTrees = (slots, sources, shadows) => slots.forEach((slot, i) => {
  const src = sources.find(s => s.name === (i % 3 === 2 ? 'island_tree_01' : 'tree_small_02'))
  const tree = src.scene.clone()
  tree.scale.setScalar((slot.scale ?? range(3.3, 4.6)) * src.fit)
  tree.rotation.y = range(0, Math.PI * 2)
  tree.position.set(slot.x, GROUND_Y - 0.1, slot.z)
  tree.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = o.receiveShadow = shadows
    if (!shadows) o.layers.set(NO_AO)
  })
  scene.add(tree)
  if (shadows) nearTrees.push(tree)
})
const loadTrees = (suffix, slots, shadows) => {
  const sources = []
  ;[['tree_small_02', 1], ['island_tree_01', 0.85]].forEach(([name, fit]) => {
    gltfLoader.load(`/models/vegetation/${name}${suffix}.glb`, (gltf) => {
      sources.push({ scene: prepTree(gltf), fit, name })
      if (sources.length === 2) placeTrees(slots, sources, shadows)
    })
  })
}
loadTrees('', nearSlots, true)
loadTrees('_far', farSlots, false)

// UNDERGROWTH: Poly Haven fern_02, shrub_02, shrub_04, nettle_plant (CC0), instanced, alpha masked
const plants = [
  { name: 'fern_02', count: 420, scale: [1.5, 2.6] },
  { name: 'shrub_04', count: 10, scale: [1.8, 2.8] },
  { name: 'shrub_02', count: 24, scale: [1.8, 3] },
  { name: 'nettle_plant', count: 48, scale: [1.4, 2.2] }
]
const dummy = new THREE.Object3D()
plants.forEach((plant) => {
  const alpha = textureLoader.load(`/models/vegetation/${plant.name}/textures/${plant.name}_alpha_1k.jpg`)
  alpha.flipY = false
  gltfLoader.load(`/models/vegetation/${plant.name}/${plant.name}_1k.gltf`, (gltf) => {
    const variants = []
    gltf.scene.traverse((o) => { if (o.isMesh) variants.push(o) })
    const per = Math.ceil(plant.count / variants.length)
    variants.forEach((v) => {
      const m = v.material
      m.alphaMap = alpha
      m.alphaTest = 0.45
      m.transparent = false
      m.side = THREE.DoubleSide
      m.envMapIntensity = 0.6
      backlit(m, 0.9)
      const g = v.geometry.clone()
      g.applyMatrix4(new THREE.Matrix4().makeScale(...v.getWorldScale(new THREE.Vector3()).toArray()))
      const inst = new THREE.InstancedMesh(g, m, per)
      let n = 0
      for (let tries = 0; n < per && tries < per * 40; tries++) {
        // cluster round the house edges, the path verges and the tree bases
        const a = range(0, Math.PI * 2), r = range(4, 26) * Math.sqrt(rand())
        const x = Math.cos(a) * (r + 3), z = Math.sin(a) * (r + 3)
        const dp = distToPath(x, z)
        if (dp < 1.4 || nearHouse(x, z, -0.5) || (inHeroCorridor(x, z) && Math.hypot(x - HERO.position.x, z - HERO.position.z) < 4)) continue
        if (dp > 5 && rand() < 0.45) continue
        dummy.position.set(x, GROUND_Y, z)
        dummy.rotation.set(0, range(0, Math.PI * 2), 0)
        dummy.scale.setScalar(range(...plant.scale))
        dummy.updateMatrix()
        inst.setMatrixAt(n++, dummy.matrix)
      }
      inst.count = n
      inst.receiveShadow = true
      inst.layers.set(NO_AO)
      scene.add(inst)
    })
  })
})

// LIGHT SHAFTS: soft additive beams along the sun direction, faded at the ends and edges
const shaftMaterial = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uColor: { value: new THREE.Color(0xffc887) }, uStrength: { value: 0.085 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ float edge = pow(abs(dot(vN, vV)), 2.5); float ends = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
      gl_FragColor = vec4(uColor * uStrength * edge * ends, 1.0); }`
})
;[[-2, 1.5, 3], [3.5, 2, 6], [9, 1, 5], [-6, 2.4, 4.5], [5.5, 1.6, -5], [12, 1.2, 12]].forEach(([x, z, r]) => {
  const len = 34
  const g = new THREE.CylinderGeometry(r * 0.6, r, len, 24, 1, true)
  g.translate(0, len / 2, 0)
  const shaft = new THREE.Mesh(g, shaftMaterial)
  shaft.position.set(x, GROUND_Y, z)
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN_DIR)
  shaft.renderOrder = 2
  shaft.layers.set(NO_AO)
  scene.add(shaft)
})

// RESIZE
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(pixelRatio())
  composer.setSize(sizes.width, sizes.height)
  composer.setPixelRatio(pixelRatio())
})

// POST: AO, intro depth of field, gentle bloom, filmic grade
const composer = new EffectComposer(renderer)
composer.setPixelRatio(pixelRatio())
composer.setSize(sizes.width, sizes.height)
composer.addPass(new RenderPass(scene, camera))
const gtao = new GTAOPass(scene, aoCamera, sizes.width, sizes.height)
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 8 })
gtao.blendIntensity = 0.85
// AO at half resolution: it re-renders the whole scene for normals, the costliest pass here
const gtaoSetSize = gtao.setSize.bind(gtao)
gtao.setSize = (w, h) => gtaoSetSize(Math.ceil(w / 2), Math.ceil(h / 2))
gtao.setSize(sizes.width * pixelRatio(), sizes.height * pixelRatio())
composer.addPass(gtao)
const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0, maxblur: 0.008 })
bokeh.enabled = false
composer.addPass(bokeh)
composer.addPass(new UnrealBloomPass(new THREE.Vector2(sizes.width / 2, sizes.height / 2), 0.25, 0.6, 0.9))
composer.addPass(new OutputPass())
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uWarm: { value: new THREE.Vector3(1.04, 1.0, 0.9) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 uWarm; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uWarm;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.5);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.08);
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.9;
      gl_FragColor = vec4(c, 1.0);
    }`
}))

// UI
const ui = document.querySelector('.ui')
const hint = document.querySelector('.hint')
const forwardButton = document.querySelector('.forward')
const isTouch = window.matchMedia('(pointer: coarse)').matches
const HINTS = {
  fly: isTouch ? 'Drag to orbit, pinch to zoom, two fingers to glide' : 'Drag to orbit, scroll to zoom, right drag to glide',
  walk: isTouch ? 'Drag to look, hold the arrow to walk' : 'Click to look around, WASD or arrows to walk, Esc to release'
}

// FLY: damped drone orbit, kept above the ground
const fly = new OrbitControls(camera, canvas)
fly.enableDamping = true
fly.dampingFactor = 0.05
fly.rotateSpeed = 0.6
fly.zoomSpeed = 0.7
fly.maxPolarAngle = Math.PI * 0.485
fly.minDistance = 6
fly.maxDistance = 45
fly.enabled = false

// WALK: first person, 1.6 m eye, raycast against walls and floors
const EYE = 1.6
const STEP = 0.55
const RADIUS = 0.3
const look = new PointerLockControls(camera, document.body)
const keys = {}
const feet = new THREE.Vector3()
let fallSpeed = 0
let touchForward = false
const ray = new THREE.Raycaster()
const down = new THREE.Vector3(0, -1, 0)

const floorBelow = (x, y, z) => {
  ray.set(new THREE.Vector3(x, y + STEP, z), down)
  ray.far = STEP + 30
  const hit = ray.intersectObjects(colliders, false)[0]
  return hit ? hit.point.y : -Infinity
}

const walkStep = (dt) => {
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  const right = new THREE.Vector3(-forward.z, 0, forward.x)
  const move = new THREE.Vector3()
  if (keys.KeyW || keys.ArrowUp || touchForward) move.add(forward)
  if (keys.KeyS || keys.ArrowDown) move.sub(forward)
  if (keys.KeyD || keys.ArrowRight) move.add(right)
  if (keys.KeyA || keys.ArrowLeft) move.sub(right)
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar((keys.ShiftLeft || keys.ShiftRight ? 3.2 : 1.6) * dt)
    // two horizontal probes above step height; slide along whatever they hit
    for (const h of [STEP + 0.1, 1.45]) {
      const len = move.length()
      if (len === 0) break
      ray.set(new THREE.Vector3(feet.x, feet.y + h, feet.z), move.clone().normalize())
      ray.far = len + RADIUS
      const hit = ray.intersectObjects(colliders, false)[0]
      if (hit && hit.face) {
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        n.y = 0
        if (n.lengthSq() > 0) {
          n.normalize()
          if (n.dot(move) > 0) n.negate()
          move.addScaledVector(n, -move.dot(n))
          if (hit.distance < RADIUS) move.addScaledVector(n, RADIUS - hit.distance)
        }
      }
    }
    feet.add(move)
  }
  const floor = floorBelow(feet.x, feet.y, feet.z)
  if (floor >= feet.y - 0.05) {
    feet.y = THREE.MathUtils.lerp(feet.y, floor, Math.min(1, dt * 14))
    fallSpeed = 0
  } else {
    fallSpeed += 9.8 * dt
    feet.y = Math.max(floor, feet.y - fallSpeed * dt)
  }
  if (Math.hypot(feet.x, feet.z) > 60) feet.setLength(60)
  camera.position.set(feet.x, feet.y + EYE, feet.z)
}

window.addEventListener('keydown', (e) => { keys[e.code] = true })
window.addEventListener('keyup', (e) => { keys[e.code] = false })
canvas.addEventListener('click', () => { if (mode === 'walk' && !isTouch) look.lock() })
forwardButton.addEventListener('pointerdown', (e) => { e.preventDefault(); touchForward = true })
;['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => forwardButton.addEventListener(t, () => { touchForward = false }))

// touch look: drag rotates the camera the same way pointer lock does
const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
let lastTouch = null
canvas.addEventListener('pointerdown', (e) => { if (mode === 'walk' && e.pointerType !== 'mouse') lastTouch = { x: e.clientX, y: e.clientY } })
canvas.addEventListener('pointermove', (e) => {
  if (!lastTouch) return
  lookEuler.setFromQuaternion(camera.quaternion)
  lookEuler.y -= (e.clientX - lastTouch.x) * 0.005
  lookEuler.x = THREE.MathUtils.clamp(lookEuler.x - (e.clientY - lastTouch.y) * 0.005, -1.4, 1.4)
  camera.quaternion.setFromEuler(lookEuler)
  lastTouch = { x: e.clientX, y: e.clientY }
})
;['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, () => { lastTouch = null }))

// MODES
let mode = 'intro'
const setMode = (next) => {
  if (next === mode) return
  mode = next
  document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === next))
  hint.textContent = HINTS[next]
  forwardButton.hidden = !(next === 'walk' && isTouch)
  if (next === 'fly') {
    look.unlock()
    fly.enabled = true
    const dir = camera.getWorldDirection(new THREE.Vector3())
    fly.target.copy(camera.position).addScaledVector(dir, Math.max(8, camera.position.distanceTo(HERO.target)))
    if (fly.target.y < 1) fly.target.y = 1
  } else {
    fly.enabled = false
    // walk in from the path, facing the stair
    const start = camera.position.y < 3 && camera.position.distanceTo(HERO.target) < 25 ? camera.position : HERO.position
    feet.set(start.x, GROUND_Y, start.z)
    feet.y = floorBelow(feet.x, 40, feet.z)
    camera.position.set(feet.x, feet.y + EYE, feet.z)
    camera.lookAt(5.5, 2.4, 0.8)
  }
}
document.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setMode(b.dataset.mode) }))

// INTRO: high glide over the canopy that settles on the render 01 view; any input skips it
let intro = null
const introTarget = new THREE.Vector3()
const introLook = new THREE.CatmullRomCurve3([
  new THREE.Vector3(2, -2, 2), new THREE.Vector3(0, 2, 0), HERO.target.clone()
])
const skipIntro = () => { if (intro && intro.isActive()) intro.progress(1) }
;['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, skipIntro, { passive: true }))

const playIntro = () => {
  const state = { t: 0 }
  bokeh.enabled = true
  ui.classList.remove('visible')
  intro = gsap.to(state, {
    t: 1, duration: 7, ease: 'power2.inOut',
    onUpdate: () => {
      camera.position.copy(introCurve.getPointAt(state.t))
      camera.lookAt(introLook.getPointAt(state.t, introTarget))
      bokeh.uniforms.focus.value = camera.position.distanceTo(HERO.target)
      bokeh.uniforms.aperture.value = 0.00022 * (1 - state.t)
    },
    onComplete: () => {
      bokeh.enabled = false
      camera.position.copy(HERO.position)
      camera.lookAt(HERO.target)
      ui.classList.add('visible')
      setMode('fly')
      fly.target.copy(HERO.target)
    }
  })
}

function onLoaded() {
  if (window.__app) window.__app.loaded = true
  renderer.shadowMap.needsUpdate = true
  if (new URLSearchParams(location.search).has('nointro')) {
    camera.position.copy(HERO.position)
    camera.lookAt(HERO.target)
    ui.classList.add('visible')
    setMode('fly')
    fly.target.copy(HERO.target)
  } else playIntro()
}

// A drone pass through a crown hides that tree instead of filling the screen with leaves
const crown = new THREE.Vector3()
const updateTreeClipping = () => {
  for (const tree of nearTrees) {
    crown.copy(tree.position).y += tree.scale.y * 2.6
    tree.visible = mode !== 'fly' || camera.position.distanceTo(crown) > tree.scale.y * 2.1
  }
}

// Roof lifts away when flying high above, so the rooms show from the air
let roofLifted = false
const updateRoof = () => {
  if (!roof) return
  const lift = mode === 'fly' && camera.position.y > 13 && camera.position.y - fly.target.y > 8
  if (lift === roofLifted) return
  roofLifted = lift
  gsap.to(roof.position, { y: lift ? 7 : 0, duration: 1.6, ease: 'power2.inOut', onUpdate: () => { renderer.shadowMap.needsUpdate = true } })
}

// FPS
let frames = 0, fpsTime = performance.now(), fps = 0

const clock = new THREE.Clock()
const tick = () => {
  const dt = Math.min(clock.getDelta(), 0.05)
  if (mode === 'fly') {
    fly.update()
    if (camera.position.y < GROUND_Y + 1.2) camera.position.y = GROUND_Y + 1.2
  } else if (mode === 'walk') walkStep(dt)
  updateRoof()
  updateTreeClipping()
  sunViewDir.value.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse)
  aoCamera.copy(camera)
  aoCamera.layers.disable(NO_AO)
  composer.render()
  frames++
  const now = performance.now()
  if (now - fpsTime > 1000) {
    fps = Math.round(frames * 1000 / (now - fpsTime))
    frames = 0
    fpsTime = now
    // drop resolution in steps if the device cannot hold 50 fps (retina screens mostly)
    if (fps < 48 && pixelRatio() > 1 && mode !== 'intro') {
      maxPixelRatio = Math.max(1, pixelRatio() - 0.25)
      window.dispatchEvent(new Event('resize'))
    }
  }
  requestAnimationFrame(tick)
}
tick()

// ?debug exposes internals for scripted screenshots and fps checks
if (new URLSearchParams(location.search).has('debug')) {
  window.__app = { THREE, scene, camera, fly, renderer, colliders, composer, setMode, feet, keys, HERO, skipIntro, get mode() { return mode }, get fps() { return fps } }
}
