import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/api";

type Method = "qr" | "bluetooth" | "wifi";
type DeviceType = "dispenser" | "band";
type Step = "device" | "method" | "connecting" | "success";
const METHODS=[{key:"bluetooth",icon:"bluetooth",title:"Bluetooth",desc:"Gerät in der Nähe koppeln"},{key:"wifi",icon:"wifi",title:"WLAN",desc:"Über das Heimnetzwerk verbinden"},{key:"qr",icon:"qr-code",title:"QR-Code",desc:"Code am Gerät scannen"}];
export default function Pairing(){
 const router=useRouter(); const insets=useSafeAreaInsets(); const {activePatient}=useApp();
 const [deviceType,setDeviceType]=useState<DeviceType|null>(null); const [method,setMethod]=useState<Method|null>(null); const [step,setStep]=useState<Step>("device");
 const chooseDevice=(d:DeviceType)=>{setDeviceType(d);setStep("method")};
 const start=(m:Method)=>{setMethod(m);setStep("connecting")};
 useEffect(()=>{if(step!=="connecting"||!activePatient||!deviceType||!method)return; const t=setTimeout(async()=>{try{await api(`/patients/${activePatient.id}/devices/pair`,{method:"POST",access:true,body:{device_type:deviceType,method,name:deviceType==="dispenser"?"VYLNAX PRO":"VYLNAX Band"}});setStep("success")}catch(e:any){Alert.alert("Verbindung fehlgeschlagen","Bitte als PFK oder Arzt anmelden und erneut versuchen.");setStep("method")}},1600);return()=>clearTimeout(t)},[step,activePatient,deviceType,method]);
 return <View style={[styles.container,{paddingTop:insets.top+spacing.sm,paddingBottom:insets.bottom+spacing.lg}]}>
  <View style={styles.header}><Pressable onPress={()=>router.back()} style={styles.close}><Ionicons name="close" size={26} color={colors.onSurface}/></Pressable><Text style={styles.title}>Gerät verbinden</Text><View style={{width:40}}/></View>
  <View style={styles.body}>
   {step==="device"&&<><Text style={styles.lead}>Was möchten Sie verbinden?</Text><Card icon="medical" title="VYLNAX PRO" sub="Intelligenter Medikamentenspender" onPress={()=>chooseDevice("dispenser")}/><Card icon="watch" title="VYLNAX Band" sub="Vitalwerte, Sturz- und SOS-Erkennung" onPress={()=>chooseDevice("band")}/></>}
   {step==="method"&&<><Text style={styles.lead}>Verbindungsart wählen</Text>{METHODS.map(m=><Card key={m.key} icon={m.icon} title={m.title} sub={m.desc} onPress={()=>start(m.key as Method)}/>)}</>}
   {step==="connecting"&&<><ActivityIndicator size="large" color={colors.brandPrimary}/><Text style={styles.status}>Verbindung wird hergestellt…</Text><Text style={styles.sub}>Sichere Kopplung über {method?.toUpperCase()}</Text></>}
   {step==="success"&&<><View style={styles.success}><Ionicons name="checkmark" size={56} color="#fff"/></View><Text style={styles.status}>Erfolgreich verbunden</Text><Text style={styles.sub}>{deviceType==="dispenser"?"VYLNAX PRO":"VYLNAX Band"} ist dem Patienten zugeordnet.</Text></>}
  </View>
  {step==="success"&&<PrimaryButton label="Fertig" icon="checkmark" onPress={()=>router.back()}/>}
 </View>
}
function Card({icon,title,sub,onPress}:any){return <Pressable onPress={onPress} style={styles.card}><View style={styles.icon}><Ionicons name={icon} size={28} color={colors.brandPrimary}/></View><View style={{flex:1}}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.sub}>{sub}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.borderStrong}/></Pressable>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.surface,paddingHorizontal:spacing.lg},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},close:{width:40,height:40,alignItems:"center",justifyContent:"center"},title:{fontSize:font.lg,fontWeight:"800",color:colors.onSurface},body:{flex:1,justifyContent:"center",gap:spacing.md},lead:{fontSize:24,fontWeight:"800",color:colors.onSurface,textAlign:"center",marginBottom:spacing.lg},card:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.lg,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceSecondary},icon:{width:54,height:54,borderRadius:radius.md,backgroundColor:colors.brandSecondary,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:font.lg,fontWeight:"800",color:colors.onSurface},sub:{fontSize:13,color:colors.onSurfaceSecondary,marginTop:3,textAlign:"center"},status:{fontSize:21,fontWeight:"800",color:colors.onSurface,textAlign:"center",marginTop:spacing.lg},success:{width:120,height:120,borderRadius:60,backgroundColor:colors.success,alignSelf:"center",alignItems:"center",justifyContent:"center"}});
