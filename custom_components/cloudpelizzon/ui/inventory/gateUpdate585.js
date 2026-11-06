export function gateUpdate585(o,key,value,height){
 if(key==='gate_wicket')o[key]=!!value;
 else if(['offset','gate_open','gate_wicket_open','gate_wicket_position'].includes(key))o[key]=Math.max(0,Math.min(1,Number(value)/100));
 else if(['width_m','height_m','gate_wicket_width_m','gate_wicket_height_m'].includes(key))o[key]=Math.max(key==='width_m'?.2:.5,Math.min(key==='width_m'?20:key==='gate_wicket_width_m'?1.5:key==='gate_wicket_height_m'?(o.height_m||2.2)-.08:height,Number(value)));
 else o[key]=value;
 if(o.gate_mode==='rollup')o.gate_wicket=false;
 if(o.gate_wicket){const available=o.width_m/(o.gate_mode==='slide_double'||o.gate_mode==='swing_double'?2:1)-.14;if(available<.5)o.gate_wicket=false;else o.gate_wicket_width_m=Math.min(available,o.gate_wicket_width_m||.8);o.gate_wicket_height_m=Math.min((o.height_m||2.2)-.1,o.gate_wicket_height_m||1.95);}
 return o;
}
