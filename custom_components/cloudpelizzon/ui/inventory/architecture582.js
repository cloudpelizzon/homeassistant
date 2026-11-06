import { HYDRAULICS606 as e } from "./hydraulics606.js?v=606";

import { CLIMATE605 as o } from "./climate605.js?v=611";

import { TANKS603 as r } from "./tanks603.js?v=606";

import { KITCHEN598 as a } from "./kitchenCatalog598.js?v=598";

export const SIDES582 = [ "top", "right", "bottom", "left" ];

export const ITEMS582 = [ [ "fireplace", "Lareira com lenha", "hall", 1.25, .5, 1.15 ], [ "console_table", "Aparador", "hall", 1.5, .4, .85 ], [ "spin_bike", "Bicicleta spinning", "hall", .65, 1.2, 1.2 ], [ "treadmill", "Esteira de corrida", "hall", .85, 1.8, 1.4 ], [ "tv_panel", "Painel de parede para TV", "living", 2.2, .16, 1.7 ], [ "dining_8", "Mesa com 8 cadeiras", "dining", 2.6, 1.55, .78 ], [ "microwave", "Micro-ondas", "kitchen", .52, .4, .3, .91 ], [ "water_dispenser", "Bebedouro elétrico", "kitchen", .3, .32, .5, .91 ], [ "air_fryer", "Air fryer", "kitchen", .32, .36, .36, .91 ], [ "electric_kettle", "Chaleira elétrica", "kitchen", .23, .25, .28, .91 ], [ "supplements", "Potes de suplementos", "kitchen", .55, .24, .28, .91 ], [ "utensils", "Utensílios de bancada", "kitchen", .35, .24, .32, .91 ], [ "bbq_masonry", "Churrasqueira de alvenaria", "outdoor", 1.1, .8, 2.3 ], [ "flowers", "Flores em vaso", "outdoor", .5, .5, .5 ], [ "vertical_garden", "Horta vertical de parede", "outdoor", 1.2, .25, 1.5, .4 ], [ "gas_shelter", "Abrigo de botijão de gás", "outdoor", .8, .65, 1 ], [ "lawn", "Canteiro / área de grama editável", "outdoor", 2, 2, .1 ], [ "wood_deck", "Deck de madeira", "outdoor", 3, 2, .15 ], [ "shade_sail", "Vela de tecido / quebra-sol", "outdoor", 3, 3, .2, 2.3 ], [ "bbq_roof", "Cobertura de telhas", "outdoor", 3, 2.5, .35, 2.2 ], [ "bbq_sink", "Pia para churrasqueira", "outdoor", 1.4, .6, .9 ] ].map(([e, o, r, a, t, i, s = 0]) => ({
    id: e,
    label: o,
    group: r,
    w: a,
    d: t,
    h: i,
    elevation: s
}));

ITEMS582.push({
    id: "ev_wallbox",
    label: "Carregador veicular de parede · wallbox",
    group: "garage",
    w: .3,
    d: .2,
    h: .55,
    elevation: 1.1
}, {
    id: "ev_pedestal",
    label: "Carregador veicular em pedestal",
    group: "garage",
    w: .42,
    d: .32,
    h: 1.55,
    elevation: 0
}, {
    id: "ev_dual",
    label: "Estação de recarga dupla",
    group: "garage",
    w: .72,
    d: .45,
    h: 1.75,
    elevation: 0
}, {
    id: "flower_bed",
    label: "Canteiro de flores retangular",
    group: "outdoor",
    w: .5,
    d: 3.5,
    h: .45,
    elevation: 0
}, {
    id: "flower_bed_corner",
    label: "Canteiro de flores em L",
    group: "outdoor",
    w: 1.6,
    d: 2.5,
    h: .45,
    elevation: 0
}), ITEMS582.push(...a), ITEMS582.push({
    id: "wall_picture",
    label: "Foto / quadro de parede",
    group: "photos",
    w: .45,
    d: .1,
    h: .65,
    elevation: 1.15
});

export function rotateRoom582(e) {
    const o = structuredClone(e), r = o.width_m || Math.sqrt(o.area_m2 || 9), a = o.depth_m || r, point = e => ({
        ...e,
        x: 1 - e.y,
        y: e.x
    });
    return o.width_m = a, o.depth_m = r, o.area_m2 = Math.round(r * a * 100) / 100, 
    o.covers = (o.covers || []).map(e => ({
        ...e,
        x_m: a - e.y_m - e.depth_m,
        y_m: e.x_m,
        width_m: e.depth_m,
        depth_m: e.width_m,
        axis: "x" === e.axis ? "y" : "x"
    })), o.wall_heights && (o.wall_heights = Object.fromEntries(Object.entries(o.wall_heights).map(([e, o]) => [ SIDES582[(SIDES582.indexOf(e) + 1) % 4], o ]))), 
    o.pipes = (o.pipes || []).map(e => ({
        ...e,
        points: e.points.map(e => ({
            x: a - e.z,
            y: e.y,
            z: e.x
        }))
    })), o.furniture = (o.furniture || []).map(e => ({
        ...point(e),
        rotation: ((e.rotation || 0) + 90) % 360
    })), o.device_positions = Object.fromEntries(Object.entries(o.device_positions || {}).map(([e, o]) => [ e, {
        ...point(o),
        ...SIDES582.includes(o.surface) ? {
            surface: SIDES582[(SIDES582.indexOf(o.surface) + 1) % 4]
        } : {},
        ...null != o.rotation ? {
            rotation: (o.rotation + 90) % 360
        } : {}
    } ])), o.electric_fence?.sides && (o.electric_fence.sides = o.electric_fence.sides.map(e => SIDES582[(SIDES582.indexOf(e) + 1) % 4])), 
    o.open_walls = (o.open_walls || []).map(e => SIDES582[(SIDES582.indexOf(e) + 1) % 4]), 
    o.appearance?.walls && (o.appearance.walls = Object.fromEntries(Object.entries(o.appearance.walls).map(([e, o]) => [ SIDES582[(SIDES582.indexOf(e) + 1) % 4], o ]))), 
    null != o.appearance?.floor_rotation && (o.appearance.floor_rotation = (o.appearance.floor_rotation + 90) % 360), 
    o.openings = (o.openings || []).map(e => ({
        ...e,
        side: SIDES582[(SIDES582.indexOf(e.side) + 1) % 4],
        offset: [ "right", "left" ].includes(e.side) ? 1 - e.offset : e.offset
    })), o.partitions = (o.partitions || []).map(e => ({
        ...e,
        x1: 1 - e.y1,
        y1: e.x1,
        x2: 1 - e.y2,
        y2: e.x2
    })), o;
}

export function partitionSVG582(e, o, r) {
    return (e.partitions || []).map(a => `<line x1="${a.x1 * o}" y1="${a.y1 * r}" x2="${a.x2 * o}" y2="${a.y2 * r}" stroke="${a.color || "#d9d1c3"}" stroke-width="${(a.thickness_m || .12) * o / (e.width_m || 3)}" stroke-linecap="square"/>`).join("");
}

export function pushHouseHistory582(e, o) {
    e.houseHistory582 ??= [], e.houseHistory582.push(structuredClone(o)), e.houseHistory582 = e.houseHistory582.slice(-5);
}

export function sceneCamera582(e, o) {
    return "2d" === o ? {
        ...e,
        yaw: 0,
        elevation: 89.9
    } : e;
}

export const hasFurniture582 = e => ITEMS582.some(o => o.id === e) || [ "refrigerator", "kitchen_counter", "kitchen_island", "sink", "grill" ].includes(e);

ITEMS582.push(...r), ITEMS582.push(...o), ITEMS582.push(...e);
