import * as THREE from "three";
import type { Tile, World } from "./game";

export class GameRenderer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private renderer: THREE.WebGLRenderer;
  private board = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private center = new THREE.Vector3();
  private angle = Math.PI / 4;
  private zoom = 21;
  private size = 12;
  private dragging: {
    x: number;
    y: number;
    button: number;
    moved: boolean;
  } | null = null;
  private suppressClick = false;
  private tileGeometry = new THREE.BoxGeometry(0.96, 1, 0.96);
  private houseGeometry = new THREE.ConeGeometry(0.32, 0.65, 4);
  private peopleGeometry = new THREE.SphereGeometry(0.17, 8, 6);
  private materials = {
    grass: new THREE.MeshStandardMaterial({ color: 0x7ca962 }),
    hill: new THREE.MeshStandardMaterial({ color: 0xa2b882 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3e91ad,
      transparent: true,
      opacity: 0.88,
    }),
    player: new THREE.MeshStandardMaterial({ color: 0x4c79e8 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0xe15f50 }),
  };
  private resizeObserver: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private onPick: (x: number, z: number) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x12212a);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Game map. Select an action and click a tile.",
    );
    this.container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xe4f6ff, 0x536343, 2));
    const sun = new THREE.DirectionalLight(0xfff1d9, 2);
    sun.position.set(6, 20, 8);
    this.scene.add(sun, this.board);
    this.renderer.domElement.addEventListener("click", this.pick);
    this.renderer.domElement.addEventListener("wheel", this.wheel, {
      passive: false,
    });
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.pointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.pointerUp);
    this.renderer.domElement.addEventListener(
      "contextmenu",
      this.preventContextMenu,
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render() {
    this.camera.position.set(
      this.center.x + Math.cos(this.angle) * this.zoom,
      this.zoom * 0.9,
      this.center.z + Math.sin(this.angle) * this.zoom,
    );
    this.camera.lookAt(this.center);
    this.renderer.render(this.scene, this.camera);
  }

  private pick = (event: MouseEvent) => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster
      .intersectObjects(this.board.children, false)
      .find((item) => item.object.userData.tile);
    if (hit) this.onPick(hit.object.userData.x, hit.object.userData.z);
  };

  private preventContextMenu = (event: MouseEvent) => event.preventDefault();
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return;
    this.dragging = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      moved: false,
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragging.x;
    const dy = event.clientY - this.dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) this.dragging.moved = true;
    if (this.dragging.button === 0) this.angle -= dx * 0.008;
    else {
      this.center.x -= dx * this.zoom * 0.002;
      this.center.z -= dy * this.zoom * 0.002;
    }
    this.dragging.x = event.clientX;
    this.dragging.y = event.clientY;
    this.render();
  };
  private pointerUp = () => {
    this.suppressClick = !!this.dragging?.moved && this.dragging.button === 0;
    this.dragging = null;
  };

  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoom = THREE.MathUtils.clamp(
      this.zoom + Math.sign(event.deltaY) * 1.5,
      6,
      this.size * 3,
    );
    this.render();
  };

  cameraAction(action: string) {
    if (action === "rotateLeft") this.angle -= Math.PI / 8;
    if (action === "rotateRight") this.angle += Math.PI / 8;
    if (action === "zoomIn") this.zoom = Math.max(6, this.zoom - 2);
    if (action === "zoomOut")
      this.zoom = Math.min(this.size * 3, this.zoom + 2);
    if (action === "panLeft") this.center.x -= 1;
    if (action === "panRight") this.center.x += 1;
    if (action === "panUp") this.center.z -= 1;
    if (action === "panDown") this.center.z += 1;
    this.render();
  }

  update(world: World) {
    if (this.size !== world.size) {
      this.size = world.size;
      this.center.set((world.size - 1) / 2, 0, (world.size - 1) / 2);
      this.zoom = world.size * 1.7;
    } else if (!this.board.children.length) {
      this.center.set((world.size - 1) / 2, 0, (world.size - 1) / 2);
    }
    this.board.clear();
    for (const tile of world.tiles) this.addTile(tile);
    this.render();
  }

  private addTile(tile: Tile) {
    const height = tile.height ? tile.height * 0.42 : 0.08;
    const ground = new THREE.Mesh(
      this.tileGeometry,
      tile.height === 0
        ? this.materials.water
        : tile.height > 1
          ? this.materials.hill
          : this.materials.grass,
    );
    ground.scale.y = height;
    ground.position.set(tile.x, height / 2, tile.z);
    ground.userData = { tile: true, x: tile.x, z: tile.z };
    this.board.add(ground);
    if (tile.settlement) {
      const house = new THREE.Mesh(
        this.houseGeometry,
        this.materials[tile.settlement],
      );
      house.position.set(tile.x, height + 0.32, tile.z);
      this.board.add(house);
    }
    for (const side of ["player", "enemy"] as const) {
      const count = tile.people[side];
      if (!count) continue;
      for (let i = 0; i < Math.min(4, Math.ceil(count / 4)); i++) {
        const person = new THREE.Mesh(
          this.peopleGeometry,
          this.materials[side],
        );
        person.position.set(
          tile.x - 0.3 + i * 0.2,
          height + 0.2,
          tile.z + (side === "player" ? 0.28 : -0.28),
        );
        this.board.add(person);
      }
    }
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("click", this.pick);
    this.renderer.domElement.removeEventListener("wheel", this.wheel);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.pointerMove,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.removeEventListener(
      "pointercancel",
      this.pointerUp,
    );
    this.renderer.domElement.removeEventListener(
      "contextmenu",
      this.preventContextMenu,
    );
    this.tileGeometry.dispose();
    this.houseGeometry.dispose();
    this.peopleGeometry.dispose();
    Object.values(this.materials).forEach((material) => material.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
