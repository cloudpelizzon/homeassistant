import { hydraulicObject606 as e } from "./hydraulics606.js?v=606";

import { climate605 as o } from "./climate605.js?v=611";

import { tank603 as t } from "./tanks603.js?v=606";

import { wallFrame599 as r } from "./wallPhoto599.js?v=599";

import { kitchen598 as n } from "./kitchen598.js?v=598";

import { diningFurniture592 as s, diningKind592 as a } from "./dining592.js?v=592";

import { flowerBed585 as i } from "./flowerBed585.js?v=586";

import * as c from "./vendor/three.module.min.js";

import { ITEMS582 as b } from "./architecture582.js?v=606";

const l = new Map;

function mat(e, o = .6, t = 0) {
    const r = [ e, o, t ].join();
    if (!l.has(r)) {
        const n = new c.MeshStandardMaterial({
            color: e,
            roughness: o,
            metalness: t
        });
        n.userData.shared581 = !0, l.set(r, n);
    }
    return l.get(r);
}

function mesh(e, o, t, r = 0, n = 0, s = 0) {
    const a = new c.Mesh(o, t);
    return a.position.set(r, n, s), a.castShadow = !0, a.receiveShadow = !0, e.add(a), 
    a;
}

function box(e, o, t, r, n, s, a, i = "#d9d6ce", b = .025) {
    const l = Math.min(b, o / 4, t / 4, r / 4), f = new c.Shape, d = -o / 2, u = -t / 2;
    f.moveTo(d + l, u), f.lineTo(d + o - l, u), f.quadraticCurveTo(d + o, u, d + o, u + l), 
    f.lineTo(d + o, u + t - l), f.quadraticCurveTo(d + o, u + t, d + o - l, u + t), 
    f.lineTo(d + l, u + t), f.quadraticCurveTo(d, u + t, d, u + t - l), f.lineTo(d, u + l), 
    f.quadraticCurveTo(d, u, d + l, u);
    const m = new c.ExtrudeGeometry(f, {
        depth: r - 2 * l,
        bevelEnabled: !0,
        bevelThickness: l,
        bevelSize: l,
        bevelSegments: 3,
        curveSegments: 6,
        steps: 1
    });
    return m.translate(0, 0, -r / 2 + l), mesh(e, m, mat(i), n, s, a);
}

function cylinder(e, o, t, r, n, s, a = "#adb2b3", i = .4) {
    return mesh(e, new c.CylinderGeometry(o, o, t, 32), mat(a, .35, i), r, n, s);
}

function tube(e, o, t = .02, r = "#414747", n = .4) {
    const s = new c.CatmullRomCurve3(o.map(e => new c.Vector3(...e)));
    return mesh(e, new c.TubeGeometry(s, 32, t, 10, !1), mat(r, .35, n));
}

function leaf(e, o, t, r, n, s = "#58824c") {
    const a = mesh(e, new c.SphereGeometry(.1, 12, 8), mat(s, .9), o, t, r);
    return a.scale.set(.45, 1.5, .17), a.rotation.z = n, a;
}

function flowerpot(e, o, t, r, n = !1) {
    mesh(e, new c.CylinderGeometry(.13, .09, .2, 24), mat("#bb8868", .9), o, t + .1, r), 
    cylinder(e, .115, .012, o, t + .205, r, "#45372b", 0);
    for (let s = 0; s < 7; s++) {
        const a = 2.4 * s;
        if (leaf(e, o + .1 * Math.cos(a), t + .32 + .05 * Math.sin(s), r + .1 * Math.sin(a), a), 
        n) {
            const n = new c.Vector3(o + .12 * Math.cos(a), t + .4, r + .12 * Math.sin(a));
            for (let o = 0; o < 6; o++) mesh(e, new c.SphereGeometry(.04, 10, 8), mat(s % 2 ? "#dda25c" : "#de839a"), n.x + .04 * Math.cos(o), n.y, n.z + .04 * Math.sin(o)).scale.y = .35;
        }
    }
}

const f = new Set([ ...b.map(e => e.id), "refrigerator", "kitchen_counter", "kitchen_island", "sink", "grill" ]);

export const hasFurniture582 = e => a(e) || f.has(e);

export function furniture582(a, l) {
    if (e(a, l)) return !0;
    if (o(a, l)) return !0;
    if (t(a, l)) return !0;
    if ("wall_picture" === l.type) return r(a, l);
    if (n(a, l)) return !0;
    if (s(a, l)) return !0;
    if ("flower_bed" === l.type || "flower_bed_corner" === l.type) return i(a, l);
    if (!hasFurniture582(l.type)) return !1;
    const f = l.type, d = l.color || "#ddd6ca", u = "#a9b1b4", m = "#23292c", h = "#997451";
    if ([ "ev_wallbox", "ev_pedestal", "ev_dual" ].includes(f)) {
        const e = "ev_wallbox" === f, o = "ev_dual" === f;
        if (!e) {
            box(a, o ? .6 : .28, .075, .34, 0, .04, 0, u, .015), box(a, o ? .4 : .16, 1.1, .16, 0, .6, 0, u, .025);
            for (const e of [ -.1, .1 ]) cylinder(a, .015, .015, e, .085, .1, m);
        }
        const t = e ? .28 : 1.22, r = o ? .58 : .28;
        box(a, r, .5, .18, 0, t, 0, d, .055), box(a, r - .045, .43, .022, 0, t, .105, m, .035), 
        box(a, o ? .24 : .14, .12, .012, 0, t + .075, .124, "#173948", .008), box(a, .65 * r, .012, .015, 0, t + .18, .125, "#6ed4b3", .005).material = new c.MeshStandardMaterial({
            color: "#67d9b3",
            emissive: "#43b68e",
            emissiveIntensity: .4
        });
        for (const n of o ? [ -1, 1 ] : [ 1 ]) {
            const o = n * (r / 2 + .035), s = e ? .48 : .78;
            tube(a, [ [ o, t - .12, .06 ], [ o + .1 * n, t - s, .09 ], [ o + .18 * n, t - s - .05, .17 ], [ o + .18 * n, t - .06, .2 ], [ o + .1 * n, t + .06, .16 ] ], .016, "#24292c", 0), 
            box(a, .055, .16, .065, o + .1 * n, t + .04, .16, m, .015).rotation.z = .25 * -n, 
            cylinder(a, .023, .075, o + .08 * n, t + .14, .16, u, .8);
        }
    } else if ("fireplace" === f) {
        box(a, 1.2, 1.1, .4, 0, .55, 0, "#b6aca1"), box(a, .95, .72, .05, 0, .5, .22, "#252422"), 
        box(a, 1.3, .1, .52, 0, 1.13, 0, "#d8cbb8"), box(a, 1.32, .07, .62, 0, .035, .04, "#857766");
        for (let e = 0; e < 4; e++) cylinder(a, .055, .65, .12 * (e - 1.5), .22, .26, "#675040", 0).rotation.z = 1.1;
        const e = new c.MeshStandardMaterial({
            color: "#ed9937",
            emissive: "#ff6b16",
            emissiveIntensity: 1.3,
            roughness: .8
        });
        for (let o = 0; o < 6; o++) mesh(a, new c.SphereGeometry(.1, 16, 12), o % 2 ? e : e.clone(), .1 * (o - 2.5), .34 + o % 3 * .04, .24).scale.set(.5, 1.5 + o % 3 * .3, .3);
    } else if ("spin_bike" === f) {
        for (const e of [ -.42, .42 ]) tube(a, [ [ -.28, .055, e ], [ .28, .055, e ] ], .04, m);
        tube(a, [ [ 0, .08, -.42 ], [ 0, .5, .14 ], [ 0, .1, .42 ] ], .055, "#b44739"), 
        tube(a, [ [ 0, .5, .14 ], [ 0, .75, -.27 ], [ 0, .12, -.42 ] ], .045, m), cylinder(a, .27, .09, 0, .32, .3, u, .8).rotation.z = Math.PI / 2;
        const e = mesh(a, new c.TorusGeometry(.235, .025, 12, 48), mat(m));
        e.rotation.y = Math.PI / 2, e.position.set(0, .32, .3), tube(a, [ [ 0, .5, .14 ], [ 0, 1.05, .27 ], [ 0, 1.1, .15 ] ], .025, m), 
        tube(a, [ [ -.25, 1.08, .15 ], [ 0, 1.1, .15 ], [ .25, 1.08, .15 ] ], .03, m), tube(a, [ [ 0, .53, -.23 ], [ 0, .92, -.25 ] ], .025, u), 
        box(a, .25, .07, .29, 0, .96, -.3, m, .04);
        for (const e of [ -.13, .13 ]) tube(a, [ [ 0, .5, -.02 ], [ e, .4, -.02 ] ], .015, u), 
        box(a, .15, .035, .08, e, .4, -.02, m);
        box(a, .14, .1, .04, 0, 1.02, .22, "#172c35");
    } else if ("treadmill" === f) {
        box(a, .82, .14, 1.65, 0, .1, 0, "#4b5152"), box(a, .62, .035, 1.24, 0, .19, -.1, "#23292c");
        for (let e = 0; e < 26; e++) box(a, .61, .004, .008, 0, .21, .047 * e - .7, "#4b5051", 0);
        for (const e of [ -.36, .36 ]) tube(a, [ [ e, .15, .58 ], [ e, 1.05, .6 ], [ e, 1.18, .4 ] ], .035, u), 
        tube(a, [ [ e, 1.05, .6 ], [ e, .99, -.05 ] ], .04, m);
        box(a, .62, .3, .12, 0, 1.13, .52, "#343d40").rotation.x = -.25, box(a, .3, .14, .025, 0, 1.16, .44, "#163948");
        for (const e of [ -.22, .22 ]) cylinder(a, .04, .01, e, 1.27, .48, m);
    } else if ("tv_panel" === f) {
        box(a, 2.2, 1.7, .075, 0, .85, 0, h);
        for (let e = 0; e < 27; e++) box(a, .032, 1.65, .025, .08 * e - 1.05, .85, -.05, "#75553e", .005);
        box(a, 1.65, .95, .045, 0, .98, .065, m), box(a, 1.58, .88, .007, 0, .98, .094, "#254654", .01).material = new c.MeshStandardMaterial({
            color: "#1b3541",
            roughness: .14,
            metalness: .2
        }), box(a, 1.75, .12, .32, 0, .15, .15, "#bba080");
    } else if ([ "kitchen_counter", "kitchen_island", "sink", "bbq_sink" ].includes(f)) {
        box(a, 1.75, .8, .58, 0, .45, 0, d), box(a, 1.82, .055, .64, 0, .88, 0, "#bcb6a8");
        for (let e = 0; e < 3; e++) box(a, .55, .69, .025, .58 * e - .58, .46, .3, e % 2 ? "#c5bca9" : "#d6ceba"), 
        tube(a, [ [ .58 * e - .75, .7, .325 ], [ .58 * e - .42, .7, .325 ] ], .01, u);
        if (f.includes("sink")) {
            const e = mesh(a, new c.SphereGeometry(.32, 32, 16, 0, 2 * Math.PI, 0, Math.PI / 2), mat(u, .2, .8), -.15, .9, 0);
            e.rotation.x = Math.PI, e.scale.set(1, .38, .72), tube(a, [ [ .25, .9, -.18 ], [ .25, 1.17, -.18 ], [ .15, 1.22, -.18 ], [ .02, 1.15, -.18 ] ], .018, u, .9);
        }
    } else if ("refrigerator" === f) {
        box(a, .73, 1.85, .72, 0, .925, 0, "#bbc1c2", .05), box(a, .69, .59, .035, 0, 1.52, .38, "#d1d7d7"), 
        box(a, .69, 1.11, .035, 0, .64, .38, "#cbd1d2");
        for (const e of [ .93, 1.35 ]) tube(a, [ [ .24, e, .43 ], [ .24, e + .25, .43 ] ], .018, "#6d777b");
        box(a, .14, .19, .02, -.18, 1.52, .409, "#25363a");
    } else if ([ "microwave", "air_fryer", "water_dispenser" ].includes(f)) {
        if ("microwave" === f) {
            box(a, .52, .3, .38, 0, .15, 0, u), box(a, .37, .22, .035, -.055, .15, .2, "#17282e"), 
            tube(a, [ [ .12, .07, .23 ], [ .12, .23, .23 ] ], .012, u), box(a, .08, .045, .02, .2, .23, .2, "#315451");
            for (let e = 0; e < 4; e++) cylinder(a, .012, .02, .2, .08 + .035 * e, .2, m).rotation.x = Math.PI / 2;
        }
        if ("air_fryer" === f && (box(a, .32, .36, .34, 0, .18, 0, m, .07), box(a, .24, .16, .025, 0, .11, .18, "#4e5557", .035), 
        tube(a, [ [ 0, .11, .2 ], [ 0, .18, .23 ] ], .025, m), box(a, .15, .07, .015, 0, .29, .17, "#19394a")), 
        "water_dispenser" === f) {
            box(a, .28, .48, .3, 0, .24, 0, "#e1e0da", .035), box(a, .22, .22, .025, 0, .2, .16, m);
            for (const e of [ -.055, .055 ]) tube(a, [ [ e, .28, .16 ], [ e, .25, .2 ] ], .012, e < 0 ? "#b86561" : "#5c8fa3");
            cylinder(a, .11, .22, 0, .59, 0, "#88b2c6", 0);
        }
    } else if ("electric_kettle" === f) {
        const e = [ [ 0, 0 ], [ .09, 0 ], [ .11, .04 ], [ .1, .17 ], [ .07, .23 ], [ 0, .23 ] ].map(([e, o]) => new c.Vector2(e, o));
        mesh(a, new c.LatheGeometry(e, 48), mat(u, .22, .85)), cylinder(a, .085, .02, 0, .24, 0, m), 
        tube(a, [ [ .07, .2, 0 ], [ .17, .2, 0 ], [ .18, .06, 0 ], [ .09, .04, 0 ] ], .018, m), 
        tube(a, [ [ -.08, .08, 0 ], [ -.16, .18, 0 ] ], .025, u);
    } else if ("supplements" === f) for (let e = 0; e < 3; e++) {
        const o = .18 * (e - 1), t = 1 === e ? .085 : .065, r = 1 === e ? .26 : .18;
        cylinder(a, t, r, o, r / 2, 0, e % 2 ? "#eee7d7" : "#33383a", 0), cylinder(a, 1.04 * t, .035, o, r + .012, 0, m, 0), 
        cylinder(a, 1.005 * t, .5 * r, o, .5 * r, 0, e % 2 ? "#7a9d70" : "#d1b582", 0).material.roughness = .9;
    } else if ("utensils" === f) {
        cylinder(a, .085, .15, -.08, .075, 0, "#a18b73", 0);
        for (let e = 0; e < 7; e++) {
            const o = .012 * e - .12;
            tube(a, [ [ o, .08, 0 ], [ o, .3 + e % 2 * .04, 0 ] ], .007, h), mesh(a, new c.SphereGeometry(.02, 12, 8), mat(h), o, .32 + e % 2 * .04, 0).scale.y = 1.7;
        }
        box(a, .15, .015, .24, .14, .012, 0, h, .015), tube(a, [ [ .12, .03, -.08 ], [ .12, .03, .08 ] ], .012, u);
    } else if ("console_table" === f) {
        box(a, 1.5, .07, .4, 0, .82, 0, h), box(a, 1.42, .21, .35, 0, .67, 0, "#876342");
        for (const e of [ -.65, .65 ]) for (const o of [ -.13, .13 ]) tube(a, [ [ e, .03, o ], [ e, .72, o ] ], .025, h);
        for (const e of [ -.35, .35 ]) cylinder(a, .025, .03, e, .68, .2, "#a88f58").rotation.x = Math.PI / 2;
    } else if ("dining_8" === f) {
        box(a, 2.05, .065, .88, 0, .75, 0, h, .055);
        for (const e of [ -.8, .8 ]) for (const o of [ -.32, .32 ]) tube(a, [ [ e, 0, o ], [ e, .73, o ] ], .035, "#4b453b");
        for (let e = 0; e < 3; e++) for (const o of [ -.6, .6 ]) chair(a, .66 * (e - 1), o, o > 0 ? 0 : Math.PI);
        chair(a, -1.15, 0, Math.PI / 2), chair(a, 1.15, 0, -Math.PI / 2);
    } else if ([ "bbq_masonry", "grill" ].includes(f)) {
        box(a, 1, .8, .7, 0, .4, 0, "#ba8e6e"), box(a, 1.06, .08, .8, 0, .84, 0, "#c2b6a3"), 
        box(a, .91, .75, .06, 0, 1.23, -.34, "#a37860");
        for (const e of [ -.43, .43 ]) box(a, .14, .75, .7, e, 1.23, 0, "#c19a7c");
        box(a, .88, .08, .72, 0, 1.63, 0, "#ac826a"), mesh(a, new c.CylinderGeometry(.19, .58, .45, 4), mat("#b48d71"), 0, 1.9, 0).rotation.y = Math.PI / 4, 
        box(a, .28, .35, .28, 0, 2.25, 0, "#aa8063");
        for (let e = 0; e < 12; e++) tube(a, [ [ .056 * e - .31, 1.02, -.28 ], [ .056 * e - .31, 1.02, .29 ] ], .007, u);
        for (let e = 0; e < 5; e++) box(a, .095, .05, .38, .12 * (e - 2), .89, 0, "#34312e");
    } else if ("flowers" === f) flowerpot(a, 0, 0, 0, !0); else if ("vertical_garden" === f) {
        for (let e = 0; e < 9; e++) box(a, .075, 1.5, .04, .138 * e - .55, .75, 0, h, .008);
        for (let e = 0; e < 3; e++) for (let o = 0; o < 3; o++) flowerpot(a, .37 * (o - 1), .46 * e, .1);
    } else if ("gas_shelter" === f) {
        for (const e of [ -.36, .36 ]) box(a, .05, .96, .6, e, .48, 0, "#c6bdb0");
        box(a, .8, .06, .67, 0, 1, 0, "#bcb4a9"), box(a, .65, .05, .55, 0, .025, 0, "#bcb4a9");
        for (let e = 0; e < 11; e++) box(a, .65, .025, .035, 0, .1 + .075 * e, .32, "#b4b8b1");
        cylinder(a, .18, .47, 0, .3, 0, "#8b9699"), mesh(a, new c.SphereGeometry(.18, 24, 12), mat("#8b9699"), 0, .52, 0).scale.y = .5, 
        cylinder(a, .055, .07, 0, .63, 0, "#b29559");
    } else if ("lawn" === f) {
        box(a, 2, .06, 2, 0, .03, 0, "#7b9255");
        let e = 17;
        for (let o = 0; o < 260; o++) {
            e = 1664525 * e + 1013904223 >>> 0;
            const t = e / 4294967296 * 1.94 - .97;
            e = 1664525 * e + 1013904223 >>> 0;
            const r = e / 4294967296 * 1.94 - .97;
            mesh(a, new c.ConeGeometry(.012, .055, 3), mat(o % 2 ? "#74934e" : "#94a969", 1), t, .075, r).rotation.z = .12 * (o % 5 - 2);
        }
    } else if ("wood_deck" === f) for (let e = 0; e < 18; e++) {
        box(a, 3, .09, .102, 0, .065, .112 * e - .95, e % 3 ? "#9b7651" : "#aa855c", .006);
        for (const o of [ -1.35, 1.35 ]) cylinder(a, .005, .002, o, .112, .112 * e - .95, "#444440");
    } else if ("shade_sail" === f) {
        const e = new c.PlaneGeometry(3, 3, 20, 20), o = e.attributes.position;
        for (let e = 0; e < o.count; e++) o.setZ(e, .16 * Math.cos(o.getX(e)) * Math.cos(o.getY(e)));
        e.computeVertexNormals(), mesh(a, e, new c.MeshStandardMaterial({
            color: l.color || "#e5dcc8",
            roughness: 1,
            side: c.DoubleSide
        }), 0, .15, 0).rotation.x = -Math.PI / 2;
        for (const e of [ -1.5, 1.5 ]) for (const o of [ -1.5, 1.5 ]) tube(a, [ [ e, .04, o ], [ 1.06 * e, 0, 1.06 * o ] ], .008, "#68675e");
    } else if ("bbq_roof" === f) {
        for (let e = 0; e < 14; e++) for (let o = 0; o < 12; o++) mesh(a, new c.CylinderGeometry(.095, .095, .25, 12, 1, !0, 0, Math.PI), mat((e + o) % 3 ? "#b57855" : "#a56b4c", .9), .24 * (o - 5.5), .04 + .018 * e, .18 * (e - 6.5)).rotation.x = Math.PI / 2;
        for (const e of [ -1, 1 ]) box(a, 3, .09, .08, 0, -.03, e, "#79583d");
    }
    const x = (new c.Box3).setFromObject(a), y = x.getSize(new c.Vector3), w = x.getCenter(new c.Vector3);
    for (const e of a.children) e.position.x -= w.x, e.position.y -= x.min.y, e.position.z -= w.z;
    return a.scale.set(l.width_m / (y.x || 1), (l.height_m || b.find(e => e.id === f)?.h || y.y) / (y.y || 1), l.depth_m / (y.z || 1)), 
    a.userData.customGeometry = !0, a.traverse(e => {
        e.isMesh && (e.userData = {
            ...e.userData,
            id: l.id,
            kind: "furniture"
        });
    }), !0;
}

function chair(e, o, t, r) {
    const n = new c.Group;
    e.add(n), box(n, .43, .065, .43, 0, .46, 0, "#a99c88", .04), box(n, .43, .38, .065, 0, .69, .18, "#b6a993", .04);
    for (const e of [ -.16, .16 ]) for (const o of [ -.16, .16 ]) tube(n, [ [ e, .03, o ], [ e, .46, o ] ], .018, "#675c4b");
    n.position.set(o, 0, t), n.rotation.y = r;
}
