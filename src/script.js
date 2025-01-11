import './style.css'
console.log("hello three js")
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from'gsap'
import * as dat from 'dat.gui'

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'



// CURSOR

const cursor = {
  x: 0,
  y:0
}

window.addEventListener ('mousemove', (event) => {
    cursor.x = event.clientX / sizes.width - 0.5
    cursor.y = - (event.clientY / sizes.height - 0.5)
})


// scene
const scene = new THREE.Scene()


// SIZES
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}



window.addEventListener('resize', () =>
  {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  })

// DEBUG
const gui = new dat.GUI({
  // closed: true,
  // width: 180
  // color: 'white'
})
//  gui.hide()





 // LOADING

//  const loadingBarElement = document.querySelector('.loading-bar')



//  const loadingManager = new THREE.LoadingManager(
//    () =>{
//      gsap.delayedCall(0.5, () =>
//        {
//          gsap.to(overlayMaterial.uniforms.uAlpha, {duration: 3, value : 0})
//          loadingBarElement.classList.add('ended')
//          loadingBarElement.style.transform =''
//      })
//    },

//    (itemUrl, itemsLoaded, itemsTotal) =>{

//      const progressRatio =  itemsLoaded / itemsTotal
//      loadingBarElement.style.transform = `scaleX(${progressRatio})`
//      console.log(progressRatio)

//      }
//    )


// OVERLAY

// const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)
// const overlayMaterial = new THREE.ShaderMaterial ({
//   // wireframe: true,
//   transparent: true,
//   uniforms:
//   {
//     uAlpha: { value: 1 }
//   },
//   vertexShader: `
//     void main ()
//     {
//     gl_Position =  vec4(position, 1.0);
//     }`,
//     fragmentShader:`
//     uniform float uAlpha;
//     void main ()
//     {

//       gl_FragColor = vec4(1.0, 1.0, 1.0, uAlpha);
//     }`
// })

// const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
// scene.add(overlay)









// TEXTURES
const textureLoader = new THREE.TextureLoader()
const matcapTexture = textureLoader.load('/textures/matcaps/29.png')
const texture = textureLoader.load('/textures/matcaps/16.png')


const material2 = new THREE.MeshMatcapMaterial({
  matcap: matcapTexture,
  flatShading: false,
  // roughness: 0.8,
  // metalness: 0.51,
  // wireframe: true

 })

// / FLOOR
const plateTexture = textureLoader.load('/textures/matcaps/28.png')

const floorGeometry =  new THREE.CylinderGeometry(3, 3, 1, 32)
const plateMaterial = new THREE.MeshStandardMaterial({
  map : plateTexture,
  flatShading: true,
  // roughness: 0.8,
  // metalness: 0.9
  // transparent: true,
  // opacity: 0.5,
  // blending: THREE.AdditiveBlending,
})

const floor = new THREE.Mesh(floorGeometry, plateMaterial)
floor.rotation.y = - Math.PI / 2
floor.position.set(0,-0.5,0)

floor.scale.set(10,0,10)

gsap.to(floor.scale, {
  duration: 4,  // 2 seconds duration
  y: 1,         // Animate to y=3 position
  yoyo: false,
  // repeat: -1,
ease: "sine.inOut",
});

// floor.receiveShadow = true;
scene.add(floor)

const material = new THREE.MeshStandardMaterial({
  map: matcapTexture,
  flatShading: true,
  roughness: 0.8,
  metalness: 0.8

 })




// LOADER FBX

const fbxLoader = new FBXLoader();

const loadTrees = (modelName, modelPath, onComplete) => {
  fbxLoader.load(
    modelPath, // Use the passed modelPath
    (object) => {
      object.traverse((child) => {
        if (child.isMesh) {
          child.material = material2;
        }
      })

      object.scale.set(0.001, 0.001, 0.001);
      object.position.set(1.5, -1, 1.5);
      object.rotation.x =  - Math.PI /2
      object.rotation.z =  Math.PI /2
      scene.add(object); // Add the model to the scene


      gsap.to(object.position, {
        y: 3, // Bounce upwards first (height before going back down)
        duration: 1.3, // Short duration for the "bounce"
        ease: "ease.in", // Slight easing for the bounce up
        repeat: 1, // Repeat the bounce
        yoyo: true, // Reverses the bounce effect back to the starting position
      });

      gsap.to(object.rotation, {
        z: - Math.PI /4 , // Rotate 90 degrees on the Z-axis
        duration: 2, // Slow final movement to settle
        ease: "ease.in", // Bounce easing at the end for the rotation
      });



      if (onComplete) {
        onComplete(object); // Call the onComplete callback if provided
      }
    },
    (xhr) => {

    },
    (error) => {

    }
  );
};


 loadTrees(
  'trees', // Model name
  '/models/house/trees.fbx', // Path to the model

  (model) => {

  }
);




//  GLTFLoader


const loadModel = (modelName, modelPath, onComplete) => {
  // Create a new GLTFLoader instance
  const gltfLoader = new GLTFLoader();

  gltfLoader.load(
    modelPath, // Path to the model
    (gltf) => {
      const object = gltf.scene; // The scene from the glTF file

      object.traverse((child) => {
        if (child.isMesh) {
          // child.material = material2; // Apply material
        }
      });

      object.scale.set(1, 1, 1); // Scale the object
      object.position.set(0, -3, 0); // Position the object
      // object.rotation.x = -Math.PI / 2; // Rotate the object
      scene.add(object); // Add the model to the scene

      // Animate the model's position
      gsap.to(object.position, {
        y: 0, // Target position
        duration: 2, // Animation duration
        ease: 'power2.out', // Easing function
        onComplete: () => {
          console.log('Animation complete!');
        },
      });

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete(object);
      }
    },
    (xhr) => {
      console.log(`${modelName}: ${(xhr.loaded / xhr.total) * 100}% loaded`); // Loading progress
    },
    (error) => {
      console.error(`An error occurred loading ${modelName}`, error); // Error handling
    }
  );
};

// Example usage of the function
loadModel(
  'house', // Model name
  '/models/house/house2.gltf', // Path to the glTF model

  (model) => {

  }
);




const light = new THREE.AmbientLight(0xFFFFFF, 1); // White light
scene.add(light);

// ----------------------------------------------------------------------------------


// scene.overrideMaterial = new THREE.MeshMatcapMaterial({
//   matcap: texture,
//   flatShading: false,
//   // wireframe: true
// })

      // const particleCount = 1000;
      // const particleGeometry = new THREE.BufferGeometry();
      // const particleMaterial = new THREE.PointsMaterial({
      //   color: 0xffffff,
      //   size: 0.05, // Adjust particle size
      //   transparent: true,
      //   opacity: 0.7,
      //   blending: THREE.AdditiveBlending,
      //   depthWrite: false
      // });

      // // Arrays for positions
      // const positions = [];

      // // Initialize particles with random positions
      // for (let i = 0; i < particleCount; i++) {
      //   // Randomize positions
      //   positions.push((Math.random() - 0.5) * 10); // X
      //   positions.push((Math.random() - 0.5) * 10); // Y
      //   positions.push((Math.random() - 0.5) * 10); // Z
      // }

      // // Add attributes to geometry
      // particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      // // Create the particle system
      // const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
      // scene.add(particleSystem);








// SPHERE
const backgroundTexture = textureLoader.load('/textures/matcaps/25.png')

const sphereRadius = 50
const sphereCenter = new THREE.Vector3(0, 0, 0)

const backgroundMaterial = new THREE.MeshMatcapMaterial({
  matcap: backgroundTexture,
  flatShading: false,
})

const backgroundGeometry = new THREE.SphereGeometry(sphereRadius, 64, 32); // A large sphere
const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
backgroundGeometry.scale(-1, 1, 1)
backgroundMesh.position.set(0, 0, 0)

scene.add(backgroundMesh)



// renderer
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer ({
  canvas: canvas,
  antialias: true
})



// renderer.shadowMap.enabled = true; // Enable shadow maps
// renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: softer shadows


// LIGHTS
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.5) // Color, intensity
// // gui.add(ambientLight, 'intensity').min(0).max(1).step(0.1)
// scene.add(ambientLight)

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
// directionalLight.position.set(4, 7, 4)
// directionalLight.castShadow = true;

// // gui.add(directionalLight, 'intensity').min(0).max(1).step(0.1)

// scene.add(directionalLight)

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1)
// scene.add(directionalLightHelper)

// const pointLight = new THREE.PointLight(0xffffff, 180, 20); // Color, intensity, distance
// pointLight.position.set(6, 7, 6)
// pointLight.castShadow = true;
// scene.add(pointLight)

// const pointLightHelper = new THREE.PointLightHelper(pointLight, 1) // POINT LIGHT HELPER
// scene.add(pointLightHelper)

// directionalLight.shadow.mapSize.width = 2048; // Shadow resolution
// directionalLight.shadow.mapSize.height = 2048;
// directionalLight.shadow.camera.near = 5;
// directionalLight.shadow.camera.far = 100;
// directionalLight.shadow.camera.left = -100;
// directionalLight.shadow.camera.right = 100;
// directionalLight.shadow.camera.top = 100;
// directionalLight.shadow.camera.bottom = -100;





// axis helper
const axesHelper = new THREE.AxesHelper(3)
scene.add(axesHelper)










// ----------------------------------------------------------------------------------

// Camera
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 1, 1000)

// ortho CAMERA
// const aspectRatio = sizes.width / sizes.height
// const camera = new THREE.OrthographicCamera(-1 * aspectRatio, 1 * aspectRatio, 1, -1, 0.1, 100)


camera.position.z = 15.5
camera.position.y = 10.5
camera.position.x = 15.5
scene.add(camera)


// const shadowCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
// scene.add(shadowCameraHelper);

renderer.setSize(sizes.width, sizes.height)
document.body.appendChild(renderer.domElement)


window.addEventListener('dblclick', () => {
    if(!document.fullscreenElement) {
        canvas.requestFullscreen()
    }
    else{
        document.exitFullscreen()
    }
})



// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true


controls.enableRotate = true;
// controls.enableZoom = false;
// controls.maxPolarAngle = Math.PI / 2; // 90 degrees (restrict vertical movement)
// controls.minPolarAngle = Math.PI / 4; // Optional: Set minimum angle for vertical movement





 // FOG

const fog = new THREE.FogExp2(0xffffff, 0.02); // Color and initial density (higher value means denser fog)
scene.fog = fog;




// ANIMATIONS
const tick = () => {

    // CLOCK



    // Update Controls
    controls.update()
    // constrainCamera()


    // render
    renderer.render(scene, camera)


    // animateParticles()
    window.requestAnimationFrame(tick)

  }

  tick()
