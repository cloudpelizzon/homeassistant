export const KITCHEN598=[
 ['fridge_french_door','Geladeira French Door · 3 portas inox',.91,.78,1.9,0],
 ['dishwasher_14','Lava-louças inox · 14 serviços',.6,.62,.85,0],
 ['range_inox','Fogão inox · 5 bocas e forno de vidro',.76,.65,.94,0],
 ['kitchen_upper_glass','Armário aéreo cinza · portas de vidro',1.2,.36,.75,1.55],
 ['kitchen_base_grey','Balcão cinza-claro · tampo de quartzo',1.8,.62,.91,0],
 ['kitchen_sink_grey','Pia cinza-claro · cuba inox e quartzo',1.35,.62,.91,0],
 ['water_purifier_grey','Purificador cinza · estilo Electrolux PE12G',.26,.35,.36,.93],
 ['microwave_inox','Micro-ondas contemporâneo · inox e vidro',.54,.42,.32,.93],
 ['kettle_inox','Chaleira elétrica · inox escovado',.23,.25,.28,.93]
].map(([id,label,w,d,h,elevation])=>({id,label,group:'kitchen',w,d,h,elevation}));
export const kitchenType598=type=>KITCHEN598.some(v=>v.id===type);
const replacements={refrigerator:'fridge_french_door',stove:'range_inox',cabinet:'kitchen_upper_glass',kitchen_counter:'kitchen_base_grey',kitchen_island:'kitchen_base_grey',sink:'kitchen_sink_grey',water_dispenser:'water_purifier_grey',microwave:'microwave_inox',electric_kettle:'kettle_inox'};
export const legacyKitchen598=type=>Object.hasOwn(replacements,type);
export function plannedKitchen598(room){const rows=[['fridge_french_door',.16,.15,.91,.78,0],['range_inox',.5,.14,.76,.65,0],['dishwasher_14',.82,.14,.6,.62,0],['kitchen_base_grey',.105,.65,1.6,.62,270],['kitchen_sink_grey',.895,.65,1.35,.62,90],['kitchen_upper_glass',.065,.65,1.2,.36,270],['kitchen_upper_glass',.935,.65,1.2,.36,90],['water_purifier_grey',.13,.54,.26,.35,270],['microwave_inox',.13,.79,.54,.42,270],['kettle_inox',.13,.41,.23,.25,270]];return rows.map(([type,x,y,width_m,depth_m,rotation],i)=>{const item=KITCHEN598.find(v=>v.id===type);return {id:'kitchen598-'+i,type,x,y,width_m,depth_m,rotation,height_m:item.h,...(item.elevation?{elevation_m:Math.min(item.elevation,(room.height_m||2.6)-item.h-.05)}:{})};});}
export function modernKitchen598(f){
 const type=replacements[f.type];if(!type)return f;const item=KITCHEN598.find(v=>v.id===type),next={...f,type,height_m:item.h};delete next.model;delete next.color;delete next.material;
 if(type==='kitchen_upper_glass'){next.elevation_m=item.elevation;next.depth_m=Math.min(f.depth_m,item.d);}
 if(['water_purifier_grey','microwave_inox','kettle_inox'].includes(type))next.elevation_m=f.elevation_m??item.elevation;
 return next;
}
