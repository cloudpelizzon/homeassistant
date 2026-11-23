// Remove only empty renderer background; preserve angle, objects and user zoom.
export function contentBounds736(data,width,height){
 const corners=[0,(width-1)*4,(height-1)*width*4,(height*width-1)*4];
 const background=[0,1,2].map(c=>Math.round(corners.reduce((sum,i)=>sum+data[i+c],0)/4));
 if(corners.some(i=>background.some((v,c)=>Math.abs(data[i+c]-v)>8)))return null;
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  if(data[i+3]>0&&background.some((v,c)=>Math.abs(data[i+c]-v)>4)){
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
 }
 if(right<left||bottom<top)return null;
 const pad=Math.max(4,Math.ceil(Math.max(right-left+1,bottom-top+1)*.035));
 left=Math.max(0,left-pad);top=Math.max(0,top-pad);right=Math.min(width-1,right+pad);bottom=Math.min(height-1,bottom+pad);
 if(left===0&&top===0&&right===width-1&&bottom===height-1)return null;
 return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
export async function fitPrintSnapshot736(snapshot){
 if(!snapshot?.image?.startsWith('data:image/png;base64,'))return snapshot;
 try{
  const image=new Image();image.src=snapshot.image;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const bounds=contentBounds736(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
  if(!bounds)return snapshot;
  const cropped=document.createElement('canvas');cropped.width=bounds.width;cropped.height=bounds.height;
  cropped.getContext('2d').drawImage(canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
  return {...snapshot,image:cropped.toDataURL('image/png'),width:bounds.width,height:bounds.height};
 }catch{return snapshot;}
}
