
    import * as THREE from "three";
    import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
    import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export function createRobot(canvas, hero, onReady, onError){
    let disposed=false, frame=0, loaded=false, failed=false;
    const aborter=new AbortController();
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    const fine=matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Assets optimized from the user-provided Iris HTML; unused texture maps removed.
    const HEAD_GLB = "/assets/robot/head.glb";
    const ARM_GLB = "/assets/robot/arm.glb";

    // Helper: Canvas Texture Radial Generator
    function radialTexture(stops, size = 256) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    const glowTex = radialTexture([
      [0, "rgba(160,120,255,1)"],
      [0.25, "rgba(124,77,255,.55)"],
      [0.6, "rgba(90,50,230,.12)"],
      [1, "rgba(60,30,200,0)"]
    ]);

    // Helper: Rim Shader Material
    function rimMaterial(colorHex, power = 4.0, strength = 0.5) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(colorHex) },
          uPower: { value: power },
          uStrength: { value: strength }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uPower;
          uniform float uStrength;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float f = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), uPower);
            gl_FragColor = vec4(uColor * f * uStrength, f);
          }
        `,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
    }

    // Initialize Scene, Renderer & Camera
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, fine ? 1.7 : 1.25));
    renderer.setClearColor(0xffffff,0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Environment Lighting (PMREM Studio Environment)
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x030305);

    const softboxes = [
      { color: 0xffffff, intensity: 3.2, scale: [5, 3.2, 0.3], pos: [-3, 4.5, 4] },
      { color: 0xffffff, intensity: 1.1, scale: [1.2, 6, 0.3], pos: [6, 0.5, 2] },
      { color: 0xffffff, intensity: 0.8, scale: [3, 1, 0.3], pos: [1.5, 5, -1] },
      { color: 0x9da8c0, intensity: 1.0, scale: [4, 5, 0.3], pos: [-5, 0, -4] },
      { color: 0x9da8c0, intensity: 1.0, scale: [4, 5, 0.3], pos: [5, 0, -4] },
      { color: 0x1c2338, intensity: 0.35, scale: [6, 3, 0.3], pos: [0, -5, 1] }
    ];

    const boxGeo = new THREE.SphereGeometry(0.5, 32, 16);
    softboxes.forEach(s => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(s.color).multiplyScalar(s.intensity)
      });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.scale.set(...s.scale);
      mesh.position.set(...s.pos);
      mesh.lookAt(0, 0, 0);
      envScene.add(mesh);
    });

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(envScene, 0.02).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 1.0;

    // Additional Scene Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8891a4, 2.3);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
    dirLight.position.set(-3, 4, 5);
    scene.add(dirLight);

    // Rig Hierarchy Setup
    const robot = new THREE.Group();
    const body = new THREE.Group();
    const head = new THREE.Group();

    scene.add(robot);
    robot.add(body);
    body.add(head);

    // Visual Background Atmosphere Elements
    const bgHazeMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x7a55ff,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false
    });
    const bgHaze = new THREE.Sprite(bgHazeMat);
    bgHaze.scale.set(7.5, 7.5, 1);
    bgHaze.position.set(0, 0.1, -3);
    scene.add(bgHaze);bgHaze.visible=false;

    const floorGlowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x8f6bff,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorGlowMat);
    floorGlow.position.set(0, -2.05, -0.6);
    floorGlow.scale.set(3.4, 0.42, 1);
    scene.add(floorGlow);floorGlow.visible=false;

    // Prep Model helper for unified material setup
    function prepareModel(root, { glossy = true, rim, tint = "#1c2338", useMap = false, smooth = false }) {
      const meshes = [];
      root.traverse(child => {
        if (child.isMesh) meshes.push(child);
      });

      meshes.forEach(mesh => {
        if (smooth) {
          let g = mesh.geometry.clone();
          g.deleteAttribute('normal');
          g.deleteAttribute('uv');
          g.deleteAttribute('uv1');
          g.deleteAttribute('tangent');
          g.deleteAttribute('color');
          g = mergeVertices(g, 1e-3);
          g.computeVertexNormals();
          mesh.geometry = g;
        }

        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(tint),
          map: useMap ? mesh.material.map : null,
          metalness: glossy ? 0.1 : 0.0,
          roughness: glossy ? 0.3 : 0.48,
          clearcoat: glossy ? 1.0 : 0.3,
          clearcoatRoughness: glossy ? 0.16 : 0.4,
          envMapIntensity: glossy ? 0.9 : 0.55
        });
        mesh.material = mat;

        if (rim) {
          const rimShell = new THREE.Mesh(mesh.geometry, rimMaterial(rim.color || 0x8490ab, rim.power, rim.strength));
          rimShell.renderOrder = 2;
          mesh.add(rimShell);
        }
      });
    }

    // Eye References for tracking & animation
    let pupilWraps = [];
    let eyeScales = [];
    let antennaGlowMat = null;

    function mountHead(headMesh) {
      head.add(headMesh);

      // Raycast to find approximate head radius
      const raycaster = new THREE.Raycaster();
      raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
      const intersects = raycaster.intersectObject(headMesh, true);
      let R = 1.0;
      if (intersects.length > 0) {
        R = THREE.MathUtils.clamp(intersects[0].point.distanceTo(new THREE.Vector3(0,0,0)), 0.85, 1.1);
      }

      // Smooth vertex normals spherical projection
      headMesh.traverse(child => {
        if (child.isMesh) {
          const pos = child.geometry.attributes.position;
          const norm = child.geometry.attributes.normal;
          const matNorm = new THREE.Matrix3().getNormalMatrix(child.matrixWorld);
          const invMatNorm = matNorm.clone().invert();

          for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i);
            const worldV = v.clone().applyMatrix4(child.matrixWorld);
            if (Math.abs(worldV.length() - R) < R * 0.07) {
              const sphereN = worldV.clone().normalize().applyMatrix3(invMatNorm).normalize();
              norm.setXYZ(i, sphereN.x, sphereN.y, sphereN.z);
            }
          }
          norm.needsUpdate = true;
        }
      });

      // Visor Geometry Generation & Wrapping
      const addVisor = (radius) => {
        const createVisorShape = (w, h, r) => {
          const s = new THREE.Shape();
          const x = -w/2, y = -h/2;
          s.moveTo(x + r, y);
          s.lineTo(x + w - r, y);
          s.quadraticCurveTo(x + w, y, x + w, y + r);
          s.lineTo(x + w, y + h - r);
          s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          s.lineTo(x + r, y + h);
          s.quadraticCurveTo(x, y + h, x, y + h - r);
          s.lineTo(x, y + r);
          s.quadraticCurveTo(x, y, x + r, y);
          return s;
        };

        const projectToSphere = (geo, rVal, centreY) => {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            let y = pos.getY(i) + centreY;
            let zSq = rVal * rVal - x * x - y * y;
            let z = zSq > 0 ? Math.sqrt(zSq) : 0;
            pos.setXYZ(i, x, y, z);
          }
          geo.computeVertexNormals();
        };

        // Bezel
        let bShape = createVisorShape(1.86, 1.12, 0.46);
        let bGeo = new THREE.ShapeGeometry(bShape, 48).toNonIndexed();
        bGeo = mergeVertices(bGeo, 1e-3);
        projectToSphere(bGeo, radius * 1.03, -0.07);
        const bezelMat = new THREE.MeshPhysicalMaterial({
          color: 0x0c0c10,
          roughness: 0.3,
          metalness: 0.3,
          clearcoat: 0.8,
          polygonOffset: true,
          polygonOffsetFactor: -6,
          polygonOffsetUnits: -6
        });
        const bezel = new THREE.Mesh(bGeo, bezelMat);
        bezel.renderOrder = 3;
        head.add(bezel);

        // Glass Visor
        let gShape = createVisorShape(1.74, 1.0, 0.4);
        let gGeo = new THREE.ShapeGeometry(gShape, 48).toNonIndexed();
        gGeo = mergeVertices(gGeo, 1e-3);
        projectToSphere(gGeo, radius * 1.036, -0.07);
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0x000000,
          roughness: 0.12,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          envMapIntensity: 0.9,
          polygonOffset: true,
          polygonOffsetFactor: -8,
          polygonOffsetUnits: -8
        });
        const glass = new THREE.Mesh(gGeo, glassMat);
        glass.renderOrder = 4;
        head.add(glass);
      };

      addVisor(R);

      // Eyes Procedural Placement
      const eyePositions = [
        new THREE.Vector3(-0.43, -0.08, Math.sqrt(Math.max(0, Math.pow(R * 1.055, 2) - 0.43*0.43 - 0.08*0.08))),
        new THREE.Vector3(0.43, -0.08, Math.sqrt(Math.max(0, Math.pow(R * 1.055, 2) - 0.43*0.43 - 0.08*0.08)))
      ];

      const eyeIrisTex = radialTexture([
        [0, "#ffffff"],
        [0.45, "#f2f3f5"],
        [0.8, "#d9dfe9"],
        [1, "#b5bfd2"]
      ]);

      eyePositions.forEach(pos => {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.copy(pos);
        eyeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());

        // Halo Back Glow
        const haloMat = new THREE.MeshBasicMaterial({
          map: glowTex,
          color: 0x8490ab,
          opacity: 0.24,
          transparent: true,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
          depthWrite: false,
          depthTest: false
        });
        const halo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), haloMat);
        halo.position.z = -0.004;
        halo.renderOrder = 9;
        eyeGroup.add(halo);

        // Ring Frame
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xf2f3f5),
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          depthTest: false
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.168, 0.212, 64), ringMat);
        ring.renderOrder = 10;
        eyeGroup.add(ring);

        // Iris
        const irisMat = new THREE.MeshBasicMaterial({
          map: eyeIrisTex,
          color: new THREE.Color(0xffffff),
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          depthTest: false
        });
        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), irisMat);
        iris.position.z = 0.001;
        iris.renderOrder = 10;
        eyeGroup.add(iris);

        // Pupil Wrap (Holds Pupil & Glint)
        const pupilWrap = new THREE.Group();

        const pupilMat = new THREE.MeshBasicMaterial({
          color: 0x07040f,
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          depthTest: false
        });
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.083, 32), pupilMat);
        pupil.position.z = 0.003;
        pupil.renderOrder = 10;
        pupilWrap.add(pupil);

        const glintMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          depthTest: false
        });
        const glint = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), glintMat);
        glint.position.set(0.032, 0.034, 0.005);
        glint.renderOrder = 10;
        pupilWrap.add(glint);

        eyeGroup.add(pupilWrap);
        head.add(eyeGroup);

        pupilWraps.push(pupilWrap);
        eyeScales.push(eyeGroup.scale);
      });

      // Antenna Glowing Balls Detection & Attachment
      let topVertices = [];
      headMesh.traverse(child => {
        if (child.isMesh) {
          const pos = child.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
            if (v.y > 0.75 && Math.abs(v.x) > 0.15) {
              topVertices.push(v);
            }
          }
        }
      });

      const sides = [
        topVertices.filter(v => v.x < 0),
        topVertices.filter(v => v.x > 0)
      ];

      sides.forEach(pts => {
        if (pts.length === 0) return;
        pts.sort((a, b) => b.y - a.y);
        const topPt = pts[0];
        const nearPts = pts.filter(v => v.distanceTo(topPt) < 0.2);
        const ballCenter = nearPts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(nearPts.length);
        ballCenter.y = Math.max(ballCenter.y, topPt.y - 0.1);

        const ballMat = new THREE.MeshPhysicalMaterial({
          color: 0xe23b2e,
          emissive: 0xe23b2e,
          emissiveIntensity: 0.25,
          roughness: 0.22,
          clearcoat: 1.0,
          clearcoatRoughness: 0.14
        });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 16), ballMat);
        ball.position.copy(ballCenter);

        antennaGlowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xe23b2e,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
          depthWrite: false
        });
        const ballGlow = new THREE.Sprite(antennaGlowMat);
        ballGlow.scale.set(0.5, 0.5, 1);
        ball.add(ballGlow);

        head.add(ball);
      });
    }

    // Arm positioning structure
    const arms = [];
    function mountArm(armMesh, isRight) {
      const box = new THREE.Box3().setFromObject(armMesh);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const scaleFactor = 0.78 / size.y;
      armMesh.scale.setScalar(scaleFactor);
      armMesh.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor);

      const wrapper = new THREE.Group();
      wrapper.add(armMesh);

      const restX = isRight ? 1.32 : -1.32;
      const restRz = isRight ? 0.62 : -0.62;
      const phase = isRight ? Math.PI * 0.85 : 0;

      wrapper.position.set(restX, -0.72, 0.15);
      wrapper.rotation.z = restRz;

      body.add(wrapper);
      arms.push({ group: wrapper, restX, restY: -0.72, restRz, phase });
    }

    // Fallback Geometries if GLTF Load Fails
    function buildFallbackHead() {
      const fallbackGroup = new THREE.Group();
      const mainSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 32),
        new THREE.MeshPhysicalMaterial({ color: 0x1c2338, roughness: 0.26, clearcoat: 1.0 })
      );
      const rimShell = new THREE.Mesh(mainSphere.geometry, rimMaterial(0x8490ab, 4.5, 0.32));
      rimShell.renderOrder = 2;
      mainSphere.add(rimShell);
      fallbackGroup.add(mainSphere);

      // Ear Caps
      const earGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
      const earMat = new THREE.MeshPhysicalMaterial({ color: 0x1d2439, roughness: 0.4 });
      const leftEar = new THREE.Mesh(earGeo, earMat);
      leftEar.rotation.z = Math.PI / 2;
      leftEar.position.set(-1.0, 0, 0);
      const rightEar = leftEar.clone();
      rightEar.position.set(1.0, 0, 0);
      fallbackGroup.add(leftEar, rightEar);

      // Antennas
      const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16);
      const rodMat = new THREE.MeshPhysicalMaterial({ color: 0xe23b2e });
      const leftRod = new THREE.Mesh(rodGeo, rodMat);
      leftRod.position.set(-0.45, 1.1, 0);
      leftRod.rotation.z = -0.2;
      const rightRod = leftRod.clone();
      rightRod.position.set(0.45, 1.1, 0);
      rightRod.rotation.z = 0.2;
      fallbackGroup.add(leftRod, rightRod);

      return fallbackGroup;
    }

    function buildFallbackArm() {
      const fallbackArm = new THREE.Group();
      const armMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.22, 0.42, 16, 32),
        new THREE.MeshPhysicalMaterial({ color: 0x1b1b21, roughness: 0.48 })
      );
      const rimShell = new THREE.Mesh(armMesh.geometry, rimMaterial(0x8490ab, 2.6, 1.05));
      rimShell.renderOrder = 2;
      armMesh.add(rimShell);
      fallbackArm.add(armMesh);
      return fallbackArm;
    }

    // Load Models
    const loaderGLTF = new GLTFLoader();
    const loadModel=async url=>{const r=await fetch(url,{signal:aborter.signal});if(!r.ok)throw new Error("Robot model unavailable");return loaderGLTF.parseAsync(await r.arrayBuffer(),"/assets/robot/")};
    Promise.allSettled([
      loadModel(HEAD_GLB),
      loadModel(ARM_GLB)
    ]).then(results => {
      if(disposed)return;
      // Process Head Model
      if (results[0].status === "fulfilled") {
        const headScene = results[0].value.scene;
        const box = new THREE.Box3().setFromObject(headScene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 2.0 / size.z;
        headScene.scale.setScalar(scale);
        headScene.position.set(-center.x * scale, -(box.min.y + 1) * scale, -center.z * scale);

        prepareModel(headScene, {
          glossy: true,
          useMap: false,
          tint: "#1c2338",
          rim: { color: 0x8490ab, power: 4.5, strength: 0.32 }
        });
        headScene.updateMatrixWorld(true);
        mountHead(headScene);
      } else {
        const fHead = buildFallbackHead();
        mountHead(fHead);
      }

      // Process Arm Model
      if (results[1].status === "fulfilled") {
        const rawArm = results[1].value.scene;
        prepareModel(rawArm, {
          glossy: false,
          useMap: false,
          smooth: true,
          tint: "#1d2439",
          rim: { color: 0x8490ab, power: 2.6, strength: 1.05 }
        });
        const leftArmMesh = rawArm;
        const rightArmMesh = rawArm.clone(true);

        mountArm(leftArmMesh, false);
        mountArm(rightArmMesh, true);
      } else {
        mountArm(buildFallbackArm(), false);
        mountArm(buildFallbackArm(), true);
      }

      // Hide Loader & Start Scale Intro
      loaded=true;
      onReady();
      robot.scale.setScalar(motion.matches?1:0.001);
      introProgress = motion.matches?1:0;
      draw(performance.now());
      resume();
    }).catch(error=>{if(!disposed)onError(error)});

    let anchor={x:0,y:0},rx=200,ry=200;
    function layout(){
      const W=hero.clientWidth,H=hero.clientHeight;if(!W||!H)return;
      renderer.setSize(W,H,false);camera.aspect=W/H;
      const robotPx=Math.min(H*.86,W*.92);
      camera.position.z=(3.4*H)/(robotPx*2*Math.tan(camera.fov*Math.PI/360));
      camera.position.y=.1;camera.updateProjectionMatrix();anchor={x:W/2,y:H/2};rx=W*.65;ry=H*.65;
      if(loaded)draw(performance.now());
    }
    const resizeObserver=new ResizeObserver(layout);resizeObserver.observe(hero);layout();
    // Interaction & Animation Coordinates State
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const look = { x: 0, y: 0 };
    let lastMoveTime = performance.now();
    let introProgress = 0;

    function updatePointer(clientX, clientY) {
      if(!fine||motion.matches)return;
      const bounds=hero.getBoundingClientRect();clientX-=bounds.left;clientY-=bounds.top;
      target.x = THREE.MathUtils.clamp((clientX - anchor.x) / rx, -1.2, 1.2);
      target.y = THREE.MathUtils.clamp((clientY - anchor.y) / ry, -1.2, 1.2);
      lastMoveTime = performance.now();
    }

    const pointerMove=e=>updatePointer(e.clientX,e.clientY);
    const pointerLeave=()=>{target.x=0;target.y=0};
    const interaction=hero.closest('.portal-hero');interaction.addEventListener('pointermove',pointerMove,{passive:true});interaction.addEventListener('pointerleave',pointerLeave);
    // Eye Blinking State Logic
    let blinkTimer = 0;
    let nextBlinkInterval = 3.0;
    let isBlinking = false;
    let blinkProgress = 0;

    // Animation Loop
    let lastTime = performance.now();
    let isHeroVisible = true;

    const resume=()=>{cancelAnimationFrame(frame);frame=0;if(disposed||failed||!loaded||!isHeroVisible||document.hidden)return;lastTime=performance.now();if(motion.matches){draw(lastTime);return}frame=requestAnimationFrame(animate)};
    const heroObserver=new IntersectionObserver(([entry])=>{isHeroVisible=entry.isIntersecting;resume()});heroObserver.observe(hero);
    document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
    function animate(now){if(disposed||document.hidden||!isHeroVisible||motion.matches)return;frame=requestAnimationFrame(animate);if(now-lastTime<1000/(fine?45:30))return;draw(now)}
    function draw(currentTime){
      const prefersReducedMotion=motion.matches;
      if(prefersReducedMotion){target.x=0;target.y=0;look.x=0;look.y=0;introProgress=1;robot.scale.setScalar(1)}
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;
      const t = prefersReducedMotion?0:currentTime/1000;

      // Idle look-around behavior after 3.5s inactivity
      if (!prefersReducedMotion && currentTime - lastMoveTime > 3500) {
        target.x = Math.sin(t * 0.45) * 0.45;
        target.y = Math.sin(t * 0.31 + 1.2) * 0.2;
      }

      // Smooth Movement Convergence
      const lerpFactor = 1 - Math.pow(0.0025, dt);
      look.x += (target.x - look.x) * lerpFactor;
      look.y += (target.y - look.y) * lerpFactor;

      // Robot Scale Intro Pop
      if (introProgress < 1) {
        introProgress = Math.min(1, introProgress + dt * 1.4);
        const k = introProgress;
        const easeOutBack = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
        robot.scale.setScalar(Math.max(0.001, easeOutBack));
      }

      const m = prefersReducedMotion ? 0 : 1;

      // Hover / Bobbing Motion
      const bob = Math.sin(t * 1.6) * 0.09 * m;
      robot.position.y = bob;

      // Head & Body Tracking Rotations
      head.rotation.y = look.x * 0.5;
      head.rotation.x = look.y * 0.42;
      head.rotation.z = -look.x * 0.06 + Math.sin(t * 1.1) * 0.015 * m;

      body.rotation.y = look.x * 0.28;
      body.rotation.x = look.y * 0.12;

      // Floating Arms Animations
      arms.forEach(arm => {
        const w = Math.sin(t * 2.0 + arm.phase);
        const sign = Math.sign(arm.restX);
        arm.group.position.y = arm.restY + w * 0.13 * m - bob * 0.35;
        arm.group.position.x = arm.restX + sign * look.x * -0.04;
        arm.group.rotation.z = arm.restRz + w * 0.12 * sign * m;
        arm.group.rotation.x = Math.sin(t * 1.3 + arm.phase) * 0.08 * m;
      });

      // Eye Pupils Cursor Tracking
      const px = THREE.MathUtils.clamp(look.x * 0.075, -0.07, 0.07);
      const py = THREE.MathUtils.clamp(-look.y * 0.06, -0.06, 0.06);
      pupilWraps.forEach(wrap => {
        wrap.position.x = px;
        wrap.position.y = py;
      });

      // Random Eye Blinking Logic
      blinkTimer += dt;
      if (!prefersReducedMotion && !isBlinking && blinkTimer > nextBlinkInterval) {
        isBlinking = true;
        blinkProgress = 0;
        blinkTimer = 0;
        nextBlinkInterval = 2.5 + Math.random() * 3.5;
      }

      if (isBlinking) {
        blinkProgress += dt / 0.32;
        let scaleY = 1;
        if (blinkProgress <= 0.5) {
          scaleY = THREE.MathUtils.lerp(1, 0.08, blinkProgress * 2);
        } else if (blinkProgress <= 1.0) {
          scaleY = THREE.MathUtils.lerp(0.08, 1, (blinkProgress - 0.5) * 2);
        } else {
          isBlinking = false;
          scaleY = 1;
        }
        eyeScales.forEach(scale => {
          scale.y = scaleY;
        });
      }

      // Dynamic Atmosphere Effects Reacting to Motion
      floorGlow.scale.set(3.4 - bob * 3, 0.42 - bob * 0.4, 1);
      floorGlowMat.opacity = 0.7 + (0.09 - bob) * 1.5;

      if (antennaGlowMat) {
        antennaGlowMat.opacity = 0.7 * (0.85 + Math.sin(t * 1.6) * 0.15) + 0.15;
      }

      // Render Scene
      renderer.render(scene,camera);
    }

    const contextLost=e=>{e.preventDefault();failed=true;cancelAnimationFrame(frame);onError(new Error('WebGL context lost'))};canvas.addEventListener('webglcontextlost',contextLost);
    return ()=>{disposed=true;aborter.abort();cancelAnimationFrame(frame);resizeObserver.disconnect();heroObserver.disconnect();document.removeEventListener('visibilitychange',resume);motion.removeEventListener('change',resume);interaction.removeEventListener('pointermove',pointerMove);interaction.removeEventListener('pointerleave',pointerLeave);canvas.removeEventListener('webglcontextlost',contextLost);
      const geometries=new Set(),materials=new Set();for(const root of [scene,envScene])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [].concat(o.material))materials.add(m)});for(const g of geometries)g.dispose();const textures=new Set();for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose()}for(const t of textures)t.dispose();glowTex.dispose();envTexture.dispose();pmremGenerator.dispose();renderer.dispose();renderer.forceContextLoss();
    };
}
