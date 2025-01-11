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




// Camera
const camera = new THREE.PerspectiveCamera(55, sizes.width / sizes.height, 1, 1000)

// ortho CAMERA
// const aspectRatio = sizes.width / sizes.height
// const camera = new THREE.OrthographicCamera(-1 * aspectRatio, 1 * aspectRatio, 1, -1, 0.1, 100)


camera.position.z = 13
camera.position.y = 3
camera.position.x = 13



// camera.layers.enableAll();

scene.add(camera)









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





const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); // Plane pointing upwards


// TEXTURES
const textureLoader = new THREE.TextureLoader()
const matcapTexture = textureLoader.load('/textures/matcaps/29.png')
const texture = textureLoader.load('/textures/matcaps/16.png')
// const grassTexture = textureLoader.load('/textures/matcaps/16.png')


const material2 = new THREE.MeshStandardMaterial({
  map: matcapTexture,
  flatShading: false,


  // roughness: 0.8,
  // metalness: 0.51,
  // wireframe: true

 })

// / FLOOR
const plateTexture = textureLoader.load('/textures/matcaps/8.png')

const floorGeometry =  new THREE.CylinderGeometry(4, 4, 2, 32)
const plateMaterial = new THREE.MeshStandardMaterial({
  // map : plateTexture,
  color: 0x26291e,
  flatShading: false,
  roughness: 0.8,
  // metalness: 0.1
  // transparent: true,
  // opacity: 0.5,
  // blending: THREE.AdditiveBlending,
})

const floor = new THREE.Mesh(floorGeometry, plateMaterial)
floor.rotation.y = - Math.PI / 2
floor.position.set(0,-1,0)

floor.scale.set(0,0,0)

gsap.to(floor.scale, {
  duration: 2,  // 2 seconds duration
  y: 1,
  x: 6,
  z: 6,         // Animate to y=3 position
  yoyo: false,
  // repeat: -1,
  ease: "sine.inOut",
});

floor.receiveShadow = true;
scene.add(floor)

const material = new THREE.MeshStandardMaterial({
  map: matcapTexture,
  // flatShading: true,
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
          child.material = plateMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      })

      object.castShadow = true
      object.scale.set(0.001, 0.001, 0.001);
      object.position.set(1, -15, 1);
      object.rotation.x =  - Math.PI /2
      object.rotation.z = - Math.PI *2
      scene.add(object); // Add the model to the scene


      gsap.to(object.position, {
        y: 0, // Bounce upwards first (height before going back down)
        duration: 2.3, // Short duration for the "bounce"
        ease: "ease1.in", // Slight easing for the bounce up
        // repeat: 1, // Repeat the bounce
        yoyo: true, // Reverses the bounce effect back to the starting position
      });

      // gsap.to(object.rotation, {
      //   z: - Math.PI /8 , // Rotate 90 degrees on the Z-axis
      //   duration: 2, // Slow final movement to settle
      //   ease: "ease1.in", // Bounce easing at the end for the rotation
      // });



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

let floor1 = true;

if (floor1){

  setTimeout(() => {
    loadTrees(
      'trees',
      '/models/house/trees.fbx',
      (model) => {

      }
    );
  }, 1000);
}




//  GLTFLoader

const originalEmissiveColor = new THREE.Color(0x111111);

// Make it 10% of its original value by multiplying by 0.1
const emissiveColor10Percent = originalEmissiveColor.multiplyScalar(0.1);


const loadModel = (modelName, modelPath, onComplete) => {
  // Create a new GLTFLoader instance
  const gltfLoader = new GLTFLoader();

  gltfLoader.load(
    modelPath, // Path to the model
    (gltf) => {
      const object = gltf.scene; // The scene from the glTF file

      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material.roughness = 1.9;
          child.material.metalness = 0;
          child.material.emissive = emissiveColor10Percent;
          // child.material.sheen = new THREE.Color(0x444444)
          // child.material = material2; // Apply material
        }
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




let house = null;
let roof = null;

// Load the house model first
loadModel(
  'house', // Model name
  '/models/house/treeHouseNoRoof.gltf', // Path to the glTF model
  (model) => {
    house = model; // Assign the loaded model to the house variable
    house.scale.set(1, 1, 1); // Scale the object
    house.position.set(0, -3, 0); // Position the object
    scene.add(house); // Add the house model to the scene

    // Animate the house model's position
    gsap.to(house.position, {
      y: 0, // Target position
      duration: 2, // Animation duration
      ease: 'power2.out', // Easing function
      onComplete: () => {


        // Load the roof model after the house is loaded and animation is complete
        loadModel(
          'roof', // Model name
          '/models/house/roof.gltf', // Path to the glTF model
          (model) => {
            roof = model; // Assign the loaded model to the roof variable
            roof.position.set(0, +10, 0); // Start at the same initial position as the house
            roof.layers.set(2); // Assign the roof model to layer 2
            scene.add(roof); // Add the roof model to the scene

            // Animate the roof model's position
            gsap.to(roof.position, {
              y: 0, // Target position (same as the house's target position)
              duration: 3, // Animation duration
              ease: 'ease1.in', // Easing function
              onComplete: () => {
                console.log('Roof animation complete!');
              },
            });
          }
        );
      },
    });
  }
);








// ----------------------------------------------------------------------------------


// house.overrideMaterial = new THREE.MeshBasicMaterial({
//   map: texture,
//   flatShading: false,
//   // clippingPlanes: [clippingPlane],
//   // wireframe: true
// })



clippingPlane.constant = 2
clippingPlane.normal.set(0, -0.01, 0)





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
const backgroundTexture = textureLoader.load('/textures/matcaps/32.png')

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

// scene.add(backgroundMesh)



// renderer
const canvas = document.querySelector('.webgl')
const renderer = new THREE.WebGLRenderer ({
  canvas: canvas,
  antialias: true
})



renderer.shadowMap.enabled = true; // Enable shadow maps
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: softer shadows







scene.background = new THREE.Color(0x26291e);


// LIGHTS
const ambientLight = new THREE.AmbientLight(0xfffaf4, 0.8) // Color, intensity
// gui.add(ambientLight, 'intensity').min(0).max(1).step(0.1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xf8c471, 5)
directionalLight.position.set(10, 17, -14)
directionalLight.castShadow = true;

// gui.add(directionalLight, 'intensity').min(0).max(1).step(0.1)

scene.add(directionalLight)

// const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 15)
// scene.add(directionalLightHelper)

const pointLight = new THREE.PointLight(0xfff5e5, 2, 50); // Color, intensity, distance
pointLight.position.set(0.15, 4.8, -0.25)
pointLight.castShadow = true;

scene.add(pointLight)
const pointLight2 = new THREE.PointLight(0xfff5e5, 2, 50); // Color, intensity, distance
pointLight2.position.set(-4, 5.6, 0.2)
pointLight2.castShadow = true;

scene.add(pointLight2)

// const pointLightHelper = new THREE.PointLightHelper(pointLight2, 0.1) // POINT LIGHT HELPER
// scene.add(pointLightHelper)

directionalLight.shadow.mapSize.width = 2048; // Shadow resolution
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;




// axis helper
// const axesHelper = new THREE.AxesHelper(3)
// scene.add(axesHelper)





// renderer.localClippingEnabled = true;

// const material = new THREE.MeshStandardMaterial({
//   color: 0xff0000,
//   side: THREE.DoubleSide, // Show the inside faces of the clipped object
//   clippingPlanes: [clippingPlane], // Add the plane to the material
//   clipShadows: true, // Optional: Shadows cast by clipped objects are also clipped
// });


// const geometry = new THREE.BoxGeometry(2, 2, 2);
// const mesh = new THREE.Mesh(geometry, material);
// scene.add(mesh);

// ----------------------------------------------------------------------------------



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
controls.dampingFactor = 0.5;

controls.enableRotate = true;
// controls.enablePan = false;
controls.maxPolarAngle = (Math.PI / 2) - 0.1 ; // 90 degrees (restrict vertical movement)
// controls.minPolarAngle = (Math.PI / 8) - 3; // Optional: Set minimum angle for vertical movement

controls.minDistance = 8;  // Minimum distance (camera can't zoom in closer than this)
controls.maxDistance = 20;


// camera.rotation.set = Math.PI *4
// const targetCam = new THREE.Vector3(0, 15, 0)
// camera.lookAt(targetCam)
// camera.position.set(13,0,13)

controls.target.set(-3, 5, 0)
 // FOG

// const fog = new THREE.FogExp2( 0xffffff, 0.06); // Color and initial density (higher value means denser fog)
// scene.fog = fog;



let previousCameraRotation = new THREE.Euler(); // Store the initial camera rotation
previousCameraRotation.copy(camera.rotation); // Copy the initial rotation values

// Function to check for camera rotation changes
function checkCameraRotation() {
  if (roof && !camera.rotation.equals(previousCameraRotation)) {
    // If the camera's rotation has changed, animate the roof position
    gsap.to(roof.position, {
      y: roof.position.y + 15, // Move roof up by 15 units
      duration: 1, // Animation duration
      ease: 'power2.out', // Easing function
    });

    // Update the previousCameraRotation to the current rotation
    previousCameraRotation.copy(camera.rotation);
  }

  // Use requestAnimationFrame to continuously monitor the camera rotation
  requestAnimationFrame(checkCameraRotation);
}

// Call the function to start monitoring camera rotation
checkCameraRotation();



scene.fog = new THREE.Fog( 0x25281d, 1, 55 );




// ANIMATIONS
const tick = () => {

    // CLOCK



    // Update Controls
    // constrainCamera()


    // render
    renderer.render(scene, camera)
    controls.update()

    // animateParticles()
    window.requestAnimationFrame(tick)

  }

  tick()
