import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, PrimaryButton } from "@/src/components/ui";

const TYPES = [
  { key: "blood_pressure", label: "Blutdruck", unit: "mmHg", icon: "heart" },
  { key: "pulse", label: "Puls", unit: "/min", icon: "pulse" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: "water" },
  { key: "temperature", label: "Temperatur", unit: "°C", icon: "thermometer" },
  { key: "weight", label: "Gewicht", unit: "kg", icon: "scale" },
  { key: "steps", label: "Schritte", unit: "", icon: "walk" },
];

export default function VitalsScreen() {
  const { activePatient } = useApp(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [type, setType] = useState("blood_pressure"); const [value, setValue] = useState("");
  const [sys, setSys] = useState(""); const [dia, setDia] = useState(""); const [note, setNote] = useState("");
  const [summary, setSummary] = useState<any>(null); const [loading, setLoading] = useState(false);
  const load = useCallback(async()=>{ if(!activePatient) return; try{setSummary(await api(`/patients/${activePatient.id}/health-summary?days=7`));}catch{} },[activePatient]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  const save=async()=>{ if(!activePatient)return; setLoading(true); try{
    const t=TYPES.find(x=>x.key===type)!;
    const body:any={vital_type:type,unit:t.unit,source:"manual",note};
    if(type==="blood_pressure"){ body.systolic=Number(sys); body.diastolic=Number(dia); if(!body.systolic||!body.diastolic) throw new Error("Bitte beide Blutdruckwerte eingeben."); }
    else { body.value=Number(value); if(!Number.isFinite(body.value)||value.trim()==="") throw new Error("Bitte einen gültigen Wert eingeben."); }
    const res:any=await api(`/patients/${activePatient.id}/vitals`,{method:"POST",body});
    setValue("");setSys("");setDia("");setNote(""); await load();
    if(res.alert_level!=="normal") Alert.alert(res.alert_level==="critical"?"Dringender Hinweis":"Hinweis",res.alert_message||"");
  }catch(e:any){Alert.alert("Speichern nicht möglich",e.message||"Unbekannter Fehler");}finally{setLoading(false)}};
  return <View style={styles.container}>
    <View style={[styles.header,{paddingTop:insets.top+8}]}><Pressable onPress={()=>router.back()}><Ionicons name="arrow-back" size={25} color={colors.onSurface}/></Pressable><Text style={styles.title}>Vitalwerte</Text><View style={{width:25}}/></View>
    <ScrollView contentContainerStyle={{padding:spacing.lg,paddingBottom:80}}>
      <Text style={styles.patient}>{activePatient?.name||"Kein Patient ausgewählt"}</Text>
      <View style={styles.types}>{TYPES.map(t=><Pressable key={t.key} onPress={()=>setType(t.key)} style={[styles.type,type===t.key&&styles.typeActive]}><Ionicons name={t.icon as any} size={20} color={type===t.key?"#fff":colors.brandPrimary}/><Text style={[styles.typeText,type===t.key&&{color:"#fff"}]}>{t.label}</Text></Pressable>)}</View>
      <Card style={{marginTop:spacing.lg}}><Text style={styles.cardTitle}>Neue Messung</Text>
        {type==="blood_pressure"?<View style={styles.row}><TextInput value={sys} onChangeText={setSys} keyboardType="number-pad" placeholder="SYS" style={styles.input}/><Text style={styles.slash}>/</Text><TextInput value={dia} onChangeText={setDia} keyboardType="number-pad" placeholder="DIA" style={styles.input}/><Text style={styles.unit}>mmHg</Text></View>:<View style={styles.row}><TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="Wert" style={[styles.input,{flex:1}]}/><Text style={styles.unit}>{TYPES.find(x=>x.key===type)?.unit}</Text></View>}
        <TextInput value={note} onChangeText={setNote} placeholder="Notiz (optional)" style={[styles.input,{marginTop:12,width:"100%"}]}/>
        <PrimaryButton label="Messung speichern" icon="save" onPress={save} loading={loading} style={{marginTop:16}}/>
      </Card>
      <Card style={{marginTop:spacing.lg}}><Text style={styles.cardTitle}>7-Tage-Übersicht</Text><Text style={styles.meta}>{summary?.measurements||0} Messungen</Text>
        {Object.entries(summary?.latest||{}).map(([k,v]:any)=><View key={k} style={styles.latest}><Text style={styles.latestName}>{TYPES.find(x=>x.key===k)?.label||k}</Text><Text style={styles.latestVal}>{k==="blood_pressure"?`${v.systolic}/${v.diastolic}`:`${v.value} ${v.unit||""}`}</Text></View>)}
        {(summary?.insights||[]).map((x:string,i:number)=><View key={i} style={styles.insight}><Ionicons name="sparkles" size={16} color={colors.brandPrimary}/><Text style={{flex:1,color:colors.onSurfaceSecondary}}>{x}</Text></View>)}
      </Card>
      {(summary?.alerts||[]).length>0&&<Card style={{marginTop:spacing.lg}}><Text style={styles.cardTitle}>Hinweise</Text>{summary.alerts.slice(0,5).map((a:any)=><View key={a.id} style={styles.alert}><Ionicons name={a.level==="critical"?"warning":"alert-circle"} size={20} color={a.level==="critical"?colors.error:colors.warning}/><Text style={{flex:1,color:colors.onSurface}}>{a.message}</Text></View>)}</Card>}
    </ScrollView>
  </View>
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.surfaceSecondary},header:{backgroundColor:colors.surface,paddingHorizontal:spacing.lg,paddingBottom:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:colors.border},title:{fontSize:21,fontWeight:"800",color:colors.onSurface},patient:{fontWeight:"700",color:colors.brand},types:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:14},type:{width:"31%",minHeight:74,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",gap:5},typeActive:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary},typeText:{fontSize:12,fontWeight:"700",color:colors.onSurfaceSecondary},cardTitle:{fontSize:18,fontWeight:"800",color:colors.onSurface},row:{flexDirection:"row",alignItems:"center",gap:10,marginTop:16},input:{height:50,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:14,backgroundColor:colors.surface,width:95,color:colors.onSurface},slash:{fontSize:24,fontWeight:"700"},unit:{color:colors.onSurfaceSecondary,fontWeight:"600"},meta:{color:colors.onSurfaceSecondary,marginTop:5},latest:{flexDirection:"row",justifyContent:"space-between",paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.divider},latestName:{fontWeight:"600",color:colors.onSurfaceSecondary},latestVal:{fontWeight:"800",color:colors.onSurface},insight:{flexDirection:"row",gap:8,marginTop:12},alert:{flexDirection:"row",gap:10,marginTop:12,alignItems:"center"}})
